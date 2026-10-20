using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DepoRet.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
namespace DepoRet.Application;

public class AccessService(IAppDb db)
{
    public IQueryable<User> Users(Actor a)=>a.Admin?db.Users:a.Executive?db.Users.Where(u=>u.AssignedExecutiveId==a.Id):db.Users.Where(u=>u.Id==a.Id);
    public IQueryable<Payment> Payments(Actor a){var kinds=Catalog.Services.Select(s=>s.Id).ToArray();if(a.Admin||a.Executive)return db.Payments.Where(p=>kinds.Contains(p.Kind));var owners=Users(a).Select(u=>u.Id);return db.Payments.Where(p=>owners.Contains(p.UserId)&&kinds.Contains(p.Kind));}
    public IQueryable<TopUp> TopUps(Actor a)=>a.Admin||a.Executive?db.TopUps:db.TopUps.Where(p=>p.UserId==a.Id);
    public async Task Owner(Actor a,Guid userId){if(!await Users(a).AnyAsync(u=>u.Id==userId))throw new BusinessException("Recurso no encontrado.",404);}
}
public class PaymentService(IAppDb db,IConfiguration config,AccessService access)
{
    public Quote Quote(PaymentRequest r){Validation.Check(r);ValidateDetails(r);return Catalog.Price(r.Kind,r.Amount,config.GetValue<decimal>("Fiscal:VatRate"),config["Fiscal:RuleVersion"]!);}
    private static void ValidateDetails(PaymentRequest r)
    {
        var name=(r.BeneficiaryName??r.Recipient??"").Trim();if(name.Length is <3 or >120)throw new BusinessException("Ingresa el nombre completo del beneficiario.");
        if(r.DocumentType is not("Cedula" or "RUC" or "Pasaporte"))throw new BusinessException("Selecciona cédula o RUC; para giros también se admite pasaporte.");
        var doc=(r.DocumentNumber??"").Trim();if(r.DocumentType=="Cedula"&&!Validation.EcuadorianId(doc))throw new BusinessException("La cédula ecuatoriana no es válida.");
        if(r.DocumentType=="RUC"&&(doc.Length!=13||!doc.All(char.IsDigit)))throw new BusinessException("El RUC debe tener 13 dígitos.");
        if(r.Kind=="transferencia"&&r.DocumentType=="Pasaporte")throw new BusinessException("Las transferencias admiten cédula o RUC.");
        if(r.Kind=="giro"&&r.DocumentType=="Pasaporte"&&(doc.Length is <5 or >20||doc.Any(char.IsWhiteSpace)))throw new BusinessException("Número de pasaporte inválido.");
        if(r.Kind=="giro"&&r.DeliveryMethod is not("DepositoCuenta" or "RetiroEfectivo"))throw new BusinessException("Selecciona el método de entrega del giro.");
        var needsAccount=r.Kind=="transferencia"||r.Kind=="giro"&&r.DeliveryMethod=="DepositoCuenta";
        if(needsAccount){
            if(!Catalog.Banks.Contains(r.BankName??"",StringComparer.Ordinal))throw new BusinessException("Selecciona una institución financiera del catálogo.");
            if(r.AccountType is not("Ahorros" or "Corriente"))throw new BusinessException("Selecciona el tipo de cuenta.");
            if(r.AccountNumber is null||!System.Text.RegularExpressions.Regex.IsMatch(r.AccountNumber,@"^\d{8,12}$"))throw new BusinessException("El número de cuenta debe tener entre 8 y 12 dígitos.");
        }
        if(r.Kind=="giro"&&string.IsNullOrWhiteSpace(r.Reference))throw new BusinessException("Describe brevemente el motivo del giro.");
    }
    public async Task<Payment> Create(Actor actor,PaymentRequest r,string key)
    {
        actor.Demand("transactions.create");if(!actor.Client)throw new BusinessException("Solo un cliente puede emitir una operación.",403);
        var q=Quote(r);key=Validation.Key(key);if(!r.AcceptCharges)throw new BusinessException("Debes aceptar el monto y los cargos.");
        var hash=Hash(r);
        await using var tx=await db.Database.BeginTransactionAsync();
        var account=await Lock(actor.Id);
        var old=await db.Payments.SingleOrDefaultAsync(p=>p.UserId==actor.Id&&p.IdempotencyKey==key);
        if(old!=null){if(old.RequestHash!=hash)throw new BusinessException("La clave corresponde a otra solicitud.",409);return old;}
        var user=await db.Users.SingleAsync(u=>u.Id==actor.Id);
        if(!user.Active||!user.KycVerified)throw new BusinessException("Debes completar la verificación de identidad.",403);
        if(account.Balance-account.Reserved<q.Total)throw new BusinessException("Saldo disponible insuficiente.",409);
        var day=Validation.DayStart();var daily=await db.Payments.Where(p=>p.UserId==actor.Id&&p.CreatedAt>=day&&p.Status!="Rechazada").SumAsync(p=>p.Amount);
        if(daily+r.Amount>config.GetValue<decimal>("Payments:DailyLimit",10000))throw new BusinessException("Se alcanzó el límite diario configurado.",409);
        var p=new Payment{UserId=actor.Id,Kind=r.Kind,Amount=q.Amount,Fee=q.Fee,Tax=q.Tax,TaxRate=q.TaxRate,TaxRule=q.TaxRule,Total=q.Total,Recipient=(r.BeneficiaryName??r.Recipient??"").Trim(),BeneficiaryName=(r.BeneficiaryName??r.Recipient??"").Trim(),DocumentType=r.DocumentType??"",DocumentNumber=r.DocumentNumber??"",BankName=r.BankName??"",AccountType=r.AccountType??"",AccountNumber=r.AccountNumber??"",DeliveryMethod=r.DeliveryMethod??"",Reference=r.Reference?.Trim()??"",Note=r.Note?.Trim()??"",Status="Procesando",IdempotencyKey=key,RequestHash=hash,Simulated=config["Payments:Mode"]=="Sandbox"};
        account.Reserved+=q.Total;db.Payments.Add(p);db.Record(actor.Id,"payment.reserved",p.Id.ToString());db.Notify(actor.Id,"payment.changed");
        await db.SaveChangesAsync();await tx.CommitAsync();return p;
    }
    public async Task<Payment> Review(Actor actor,Guid id,ReviewRequest r)
    {
        actor.Demand("transactions.settle");Validation.Check(r);
        var owner=await access.Payments(actor).Where(p=>p.Id==id).Select(p=>(Guid?)p.UserId).SingleOrDefaultAsync()??throw new BusinessException("Operación no encontrada.",404);
        if(owner==actor.Id)throw new BusinessException("No puedes liquidar una operación propia.",403);
        if(r.Approve&&(!r.ConfirmExecuted||string.IsNullOrWhiteSpace(r.BankReference)))throw new BusinessException("Confirma la ejecución bancaria e ingresa la referencia de liquidación.");
        await using var tx=await db.Database.BeginTransactionAsync();var account=await Lock(owner);
        var p=await db.Payments.SingleAsync(p=>p.Id==id);if(p.Status!="Procesando")throw new BusinessException("La operación ya fue resuelta.",409);
        if(account.Reserved<p.Total)throw new BusinessException("La reserva no coincide; requiere conciliación.",409);
        if(r.Approve){var user=await db.Users.SingleAsync(u=>u.Id==owner);if(!user.Active||!user.KycVerified)throw new BusinessException("El cliente no está habilitado para liquidación.",409);
            account.Balance-=p.Total;p.ProviderReference=r.BankReference!.Trim();
            Ledger.Post(db,p.Id,($"customer:{owner}",p.Total,0m),("bank:clearing",0m,p.Amount),("income:fees",0m,p.Fee),("tax:vat",0m,p.Tax));}
        account.Reserved-=p.Total;p.Status=r.Approve?"Liquidada":"Rechazada";p.ReviewedBy=actor.Id;p.ReviewNote=r.Reason.Trim();p.ReviewedAt=DateTimeOffset.UtcNow;
        db.Record(actor.Id,r.Approve?"payment.settled":"payment.rejected",id.ToString());db.Notify(owner,"payment.changed");await db.SaveChangesAsync();await tx.CommitAsync();return p;
    }
    public async Task<Account> Lock(Guid user){
        var account=await db.Accounts.FromSqlInterpolated($"SELECT * FROM \"Accounts\" WHERE \"UserId\"={user} FOR UPDATE").SingleAsync();
        // A credit request spans two transactions: discard any previously tracked balance.
        await db.Accounts.Entry(account).ReloadAsync();return account;
    }
    public static string Hash(object value)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));
}
public static class Ledger
{
    public static void Post(IAppDb db,Guid? payment,params (string Account,decimal Debit,decimal Credit)[] entries)
    {
        if(entries.Sum(e=>e.Debit)!=entries.Sum(e=>e.Credit))throw new InvalidOperationException("Asiento no balanceado.");
        var batch=Guid.NewGuid();foreach(var e in entries.Where(e=>e.Debit!=0||e.Credit!=0))db.Ledger.Add(new(){BatchId=batch,PaymentId=payment,AccountCode=e.Account,Debit=e.Debit,Credit=e.Credit});
    }
}
public class TopUpService(IAppDb db,PaymentService payments,ISecretVault vault)
{
    public async Task<TopUp> Create(Actor a,TopUpRequest r,string key)
    {
        a.Demand("topups.create");if(!a.Client)throw new BusinessException("Solo los clientes solicitan acreditaciones.",403);Validation.Amount(r.Amount,50000);key=Validation.Key(key);
        var bank=r.Bank.Trim().ToUpperInvariant();var reference=r.Reference.Trim().ToUpperInvariant();var kind=r.Kind;
        if(kind is not("RecargaSaldo" or "EfectivoMovil" or "Deuna"))throw new BusinessException("Tipo de acreditación fuera del alcance.");
        if(kind=="RecargaSaldo"&&(!Catalog.Banks.Any(x=>x.Equals(r.Bank,StringComparison.OrdinalIgnoreCase))||(r.DepositorName??"").Trim().Length<3||reference.Length<3))throw new BusinessException("Selecciona un banco del catálogo y completa el depositante y el comprobante.");
        if(kind=="Deuna"&&((r.SenderName??"").Trim().Length<3||(r.TransactionReference??"").Trim().Length<3))throw new BusinessException("Completa el emisor y la referencia de Deuna.");
        if(kind=="EfectivoMovil"&&(!System.Text.RegularExpressions.Regex.IsMatch(r.PhoneNumber??"",@"^09\d{8}$")||(r.BeneficiaryName??"").Trim().Length<3||string.IsNullOrWhiteSpace(r.WithdrawalCode)||string.IsNullOrWhiteSpace(r.BeneficiaryCode)))throw new BusinessException("Completa los dos códigos, celular ecuatoriano y beneficiario.");
        var referenceKey=kind=="Deuna"?(r.TransactionReference??"").Trim().ToUpperInvariant():reference;
        var fingerprint=kind=="EfectivoMovil"?PaymentService.Hash(new{r.WithdrawalCode,r.BeneficiaryCode,r.PhoneNumber,r.Amount}):"";
        var hash=PaymentService.Hash(new{r.Amount,bank,reference,kind,r.DepositorName,r.SenderName,r.TransactionReference,r.PhoneNumber,r.BeneficiaryName,fingerprint});
        await using var tx=await db.Database.BeginTransactionAsync();await payments.Lock(a.Id);
        var old=await db.TopUps.SingleOrDefaultAsync(t=>t.UserId==a.Id&&t.IdempotencyKey==key);
        if(old!=null){if(old.RequestHash!=hash)throw new BusinessException("Clave usada para otra recarga.",409);return old;}
        if(kind=="RecargaSaldo"&&await db.TopUps.AnyAsync(t=>t.Bank==bank&&t.Reference==reference))throw new BusinessException("El comprobante ya fue registrado.",409);
        if(kind=="Deuna"&&await db.TopUps.AnyAsync(t=>t.Kind==kind&&t.TransactionReference==referenceKey))throw new BusinessException("La referencia Deuna ya fue registrada.",409);
        if(kind=="EfectivoMovil"&&await db.TopUps.AnyAsync(t=>t.Kind==kind&&t.RequestFingerprint==fingerprint))throw new BusinessException("Esta orden de Efectivo Móvil ya fue registrada.",409);
        var topup=new TopUp{UserId=a.Id,Amount=r.Amount,Bank=kind=="EfectivoMovil"?"BANCO GUAYAQUIL":kind=="Deuna"?"BANCO PICHINCHA":bank,Reference=kind=="RecargaSaldo"?reference:"",Kind=kind,DepositorName=(r.DepositorName??"").Trim(),SenderName=(r.SenderName??"").Trim(),TransactionReference=referenceKey,PhoneNumber=(r.PhoneNumber??"").Trim(),BeneficiaryName=(r.BeneficiaryName??"").Trim(),ProtectedWithdrawalCode=kind=="EfectivoMovil"?vault.Protect(r.WithdrawalCode!):"",ProtectedBeneficiaryCode=kind=="EfectivoMovil"?vault.Protect(r.BeneficiaryCode!):"",RequestFingerprint=fingerprint,IdempotencyKey=key,RequestHash=hash};db.TopUps.Add(topup);
        db.Record(a.Id,"topup.requested",topup.Id.ToString());db.Notify(a.Id,"topup.changed");await db.SaveChangesAsync();await tx.CommitAsync();return topup;
    }
    public async Task<TopUp> Review(Actor a,Guid id,TopUpReview r)
    {
        a.Demand("topups.approve");if(!a.Admin&&!a.Executive)throw new BusinessException("Solo administración u operación pueden aprobar recargas.",403);Validation.Check(r);
        var uid=await db.TopUps.Where(t=>t.Id==id).Select(t=>(Guid?)t.UserId).SingleOrDefaultAsync()??throw new BusinessException("Recarga no encontrada.",404);
        if(uid==a.Id)throw new BusinessException("No puedes aprobar tu propia recarga.",403);
        await using var tx=await db.Database.BeginTransactionAsync();var account=await payments.Lock(uid);var t=await db.TopUps.SingleAsync(t=>t.Id==id);
        if(t.Status!="Pendiente")throw new BusinessException("La recarga ya fue resuelta.",409);
        if(r.Approve){if(!await db.Users.AnyAsync(u=>u.Id==uid&&u.Active&&u.KycVerified))throw new BusinessException("La identidad del cliente debe estar verificada.",409);account.Balance+=t.Amount;Ledger.Post(db,null,("bank:deposits",t.Amount,0m),($"customer:{uid}",0m,t.Amount));}
        t.Status=r.Approve?"Aprobada":"Rechazada";t.ReviewedBy=a.Id;t.ReviewedAt=DateTimeOffset.UtcNow;t.ReviewNote=r.Reason.Trim();
        db.Record(a.Id,r.Approve?"topup.approved":"topup.rejected",id.ToString());db.Notify(uid,"topup.changed");await db.SaveChangesAsync();await tx.CommitAsync();return t;
    }
}

