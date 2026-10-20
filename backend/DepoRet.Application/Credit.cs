using System.Text.Json;
using DepoRet.Domain;
using Microsoft.EntityFrameworkCore;
namespace DepoRet.Application;
public class CreditService(IAppDb db,PaymentService payments,ISecretVault vault,ICreditProvider provider)
{
    public async Task<CreditReport> Request(Actor a,CreditQuery r,string key,CancellationToken ct)
    {
        a.Demand("credit.request");if(!a.Client)throw new BusinessException("Solo un cliente puede solicitar su reporte.",403);Validation.Check(r);key=Validation.Key(key);
        if(!r.Accepted||r.ConsentVersion!="equifax-v2")throw new BusinessException("Debes autorizar la consulta y el débito de $5.00.");
        var settings=await db.Integrations.AsNoTracking().SingleAsync(x=>x.Id=="equifax");
        if(!settings.Enabled)throw new BusinessException("El servicio de consulta de crédito está desactivado.",409);
        if(settings.Mode!="Sandbox"){if(!settings.ContractVerified||string.IsNullOrEmpty(settings.ProtectedClientId)||string.IsNullOrEmpty(settings.ProtectedApiKey)||string.IsNullOrEmpty(settings.Endpoint))throw new BusinessException("Integración Equifax pendiente de configuración y validación contractual.",409);await provider.ValidateEndpoint(settings.Endpoint,ct);}
        CreditReport report;
        await using(var tx=await db.Database.BeginTransactionAsync(ct)){
            var account=await payments.Lock(a.Id);var hash=PaymentService.Hash(new{r.Document,r.ConsentVersion});
            var old=await db.CreditReports.SingleOrDefaultAsync(x=>x.UserId==a.Id&&x.IdempotencyKey==key,ct);
            if(old!=null){if(old.DocumentHash!=hash)throw new BusinessException("La clave ya se usó para otro documento.",409);return old;}
            if(!await db.Users.AnyAsync(u=>u.Id==a.Id&&u.Active&&u.KycVerified,ct))throw new BusinessException("Verifica tu identidad antes de consultar.",403);
            if(account.Balance-account.Reserved<5m)throw new BusinessException("Saldo disponible insuficiente para el reporte de $5.00.",409);
            report=new(){UserId=a.Id,ProtectedDocument=vault.Protect(r.Document),DocumentMasked=new string('*',r.Document.Length-4)+r.Document[^4..],DocumentHash=hash,DocumentType=r.Document.Length==10?"CEDULA":"RUC",Mode=settings.Mode,IdempotencyKey=key};
            account.Balance-=5m;db.CreditReports.Add(report);Ledger.Post(db,null,($"customer:{a.Id}",5m,0m),("credit:pending",0m,5m));
            db.Record(a.Id,"credit.charged",report.Id.ToString());db.Notify(a.Id,"credit.changed");await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
        }
        // Charge is durably recorded before the network call. No automatic network retries.
        string? json=null;
        try{
            using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(25));
            json=await provider.Fetch(settings,report,r.Document,timeout.Token);
        }catch(Exception){
            // Provider failures are refunded. Persistence failures propagate for recovery.
        }
        {
            await using var tx=await db.Database.BeginTransactionAsync();var account=await payments.Lock(a.Id);
            var persisted=await db.CreditReports.AsNoTracking().SingleAsync(x=>x.Id==report.Id);
            if(persisted.Status!="Procesando")return persisted;
            report.CompletedAt=DateTimeOffset.UtcNow;
            if(json!=null){report.ReportJson=vault.Protect(json);report.Status="Completado";Ledger.Post(db,null,("credit:pending",5m,0m),("income:credit-gross",0m,5m));db.Record(a.Id,"credit.completed",report.Id.ToString());}
            else{account.Balance+=5m;report.Status="Reembolsado";report.Error="No se recibió un reporte válido. El cargo fue devuelto; usa la misma clave para consultar este resultado.";Ledger.Post(db,null,("credit:pending",5m,0m),($"customer:{a.Id}",0m,5m));db.Record(a.Id,"credit.refunded",report.Id.ToString());}
            db.Notify(a.Id,"credit.changed");await db.SaveChangesAsync();await tx.CommitAsync();
        }
        return report;
    }
    public object View(CreditReport r)=>new{r.Id,r.DocumentMasked,r.DocumentType,r.Mode,r.Status,r.Cost,r.CreatedAt,r.CompletedAt,r.Error,report=r.ReportJson==null?(JsonElement?)null:JsonSerializer.Deserialize<JsonElement>(vault.Unprotect(r.ReportJson))};
    public async Task RecoverStale(){var cutoff=DateTimeOffset.UtcNow.AddMinutes(-5);var ids=await db.CreditReports.AsNoTracking().Where(r=>r.Status=="Procesando"&&r.CreatedAt<cutoff).Select(r=>r.Id).Take(20).ToArrayAsync();
        foreach(var id in ids){var owner=await db.CreditReports.Where(r=>r.Id==id).Select(r=>r.UserId).SingleAsync();await using var tx=await db.Database.BeginTransactionAsync();var account=await payments.Lock(owner);var report=await db.CreditReports.SingleAsync(r=>r.Id==id);if(report.Status!="Procesando")continue;account.Balance+=report.Cost;report.Status="Reembolsado";report.Error="Consulta interrumpida. Se devolvió el cargo.";report.CompletedAt=DateTimeOffset.UtcNow;Ledger.Post(db,null,("credit:pending",report.Cost,0m),($"customer:{owner}",0m,report.Cost));db.Record(null,"credit.recovered",id.ToString());db.Notify(owner,"credit.changed");await db.SaveChangesAsync();await tx.CommitAsync();}}
    public async Task SaveSettings(Actor a,IntegrationChange r,CancellationToken ct){a.Demand("integrations.manage");if(!a.Admin)throw new BusinessException("No autorizado.",403);Validation.Check(r);if(r.Mode is not("Sandbox" or "Produccion"))throw new BusinessException("Modo no válido.");
        if(new[]{r.ApiKeyHeader,r.SecretHeader,r.ClientIdHeader}.Distinct(StringComparer.OrdinalIgnoreCase).Count()!=3)throw new BusinessException("Las cabeceras de credenciales deben ser distintas.");
        string[] blocked=["Host","Content-Length","Transfer-Encoding","Connection","Cookie","Forwarded","X-Forwarded-For"];
        if(blocked.Contains(r.ApiKeyHeader,StringComparer.OrdinalIgnoreCase)||blocked.Contains(r.SecretHeader,StringComparer.OrdinalIgnoreCase)||blocked.Contains(r.ClientIdHeader,StringComparer.OrdinalIgnoreCase))throw new BusinessException("Cabecera no permitida.");
        if(!r.RequestTemplate.Contains("{{document}}"))throw new BusinessException("La plantilla debe incluir {{document}}.");
        try{JsonDocument.Parse(r.RequestTemplate.Replace("{{document}}","0000000000").Replace("{{type}}","CEDULA").Replace("{{requestId}}",Guid.NewGuid().ToString())).Dispose();}catch(JsonException){throw new BusinessException("Plantilla JSON inválida.");}
        if(!string.IsNullOrWhiteSpace(r.Endpoint))await provider.ValidateEndpoint(r.Endpoint,ct);
        var s=await db.Integrations.SingleAsync(x=>x.Id=="equifax");if(r.ClearSecrets){s.ProtectedClientId="";s.ProtectedApiKey="";s.ProtectedClientSecret="";}
        if(!string.IsNullOrEmpty(r.ClientId))s.ProtectedClientId=vault.Protect(r.ClientId);if(!string.IsNullOrEmpty(r.ApiKey))s.ProtectedApiKey=vault.Protect(r.ApiKey);if(!string.IsNullOrEmpty(r.ClientSecret))s.ProtectedClientSecret=vault.Protect(r.ClientSecret);
        if(r.Mode=="Produccion"&&r.Enabled&&(!r.ContractVerified||string.IsNullOrWhiteSpace(r.Endpoint)||string.IsNullOrEmpty(s.ProtectedClientId)||string.IsNullOrEmpty(s.ProtectedApiKey)))throw new BusinessException("Producción requiere endpoint autorizado, client ID, API key y contrato validado.");
        s.Mode=r.Mode;s.Endpoint=r.Endpoint;s.RequestTemplate=r.RequestTemplate;s.ScorePath=r.ScorePath;s.ApiKeyHeader=r.ApiKeyHeader;s.ClientIdHeader=r.ClientIdHeader;s.SecretHeader=r.SecretHeader;s.ContractVerified=r.ContractVerified;s.Enabled=r.Enabled;s.UpdatedAt=DateTimeOffset.UtcNow;
        db.Record(a.Id,"integration.updated",s.Id);await db.SaveChangesAsync(ct);
    }
}

