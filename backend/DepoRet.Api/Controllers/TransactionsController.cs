using DepoRet.Application;
using DepoRet.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace DepoRet.Api.Controllers;
[Route("api")]
public class TransactionsController(IAppDb db,AccessService access,PaymentService payments,TopUpService topups,ISecretVault vault,IConfiguration config):AppController
{
    [HttpGet("catalog")]public object CatalogView()=>new{services=Catalog.Services,banks=Catalog.Banks,mode=config["Payments:Mode"],currency="USD",vatRate=config.GetValue<decimal>("Fiscal:VatRate"),taxRule=config["Fiscal:RuleVersion"]};
    [HttpGet("dashboard"),Authorize(Policy="transactions.read")]
    public async Task<object> Dashboard(){var a=Current;var accounts=a.Admin||a.Executive?db.Accounts:db.Accounts.Where(x=>x.UserId==a.Id);var query=access.Payments(a).AsNoTracking();var day=Validation.DayStart();
        var balance=await accounts.SumAsync(x=>x.Balance);var reserved=await accounts.SumAsync(x=>x.Reserved);
        return new{balance=balance-reserved,ledgerBalance=balance,reserved,todayVolume=await query.Where(p=>p.Status=="Liquidada"&&p.ReviewedAt>=day).SumAsync(p=>p.Amount),completed=await query.CountAsync(p=>p.Status=="Liquidada"),pending=await query.CountAsync(p=>p.Status=="Procesando"),fees=await query.Where(p=>p.Status=="Liquidada").SumAsync(p=>p.Fee),recent=(await query.OrderByDescending(p=>p.CreatedAt).Take(6).ToListAsync()).Select(Views.Payment),pendingTopups=Current.Permissions.Contains("topups.approve")?await access.TopUps(a).CountAsync(t=>t.Status=="Pendiente"):0};
    }
    [HttpGet("payments"),Authorize(Policy="transactions.read")]
    public async Task<object> List(string? status,string? kind,int page=1,DateOnly? from=null,DateOnly? to=null){var q=access.Payments(Current).AsNoTracking();if(status!=null)q=q.Where(p=>p.Status==status);if(kind!=null)q=q.Where(p=>p.Kind==kind);
        var range=Dates(from,to);if(range.Start!=null)q=q.Where(p=>p.CreatedAt>=range.Start);if(range.End!=null)q=q.Where(p=>p.CreatedAt<range.End);
        if(page<1||page>10000)throw new BusinessException("Página inválida.");return new{total=await q.CountAsync(),items=(await q.OrderByDescending(p=>p.CreatedAt).Skip((page-1)*20).Take(20).ToListAsync()).Select(Views.Payment)};}
    [HttpGet("payments/{id:guid}"),Authorize(Policy="transactions.read")]
    public async Task<object> Detail(Guid id)=>Views.Payment(await access.Payments(Current).AsNoTracking().SingleOrDefaultAsync(p=>p.Id==id)??throw new BusinessException("Operación no encontrada.",404));
    [HttpPost("payments/quote"),Authorize(Policy="transactions.create"),EnableRateLimiting("financial")]
    public object Quote(PaymentRequest r)=>payments.Quote(r);
    [HttpPost("transactions/quote"),Authorize(Policy="transactions.create"),EnableRateLimiting("financial")]
    public object TransactionQuote(PaymentRequest r)=>payments.Quote(r);
    [HttpPost("payments"),Authorize(Policy="transactions.create"),EnableRateLimiting("financial")]
    public async Task<object> Create(PaymentRequest r)=>Views.Payment(await payments.Create(Current,r,Key));
    [HttpPost("transactions/transfer"),Authorize(Policy="transactions.create"),EnableRateLimiting("financial")]
    public async Task<object> Transfer(PaymentRequest r){if(r.Kind!="transferencia")throw new BusinessException("El endpoint acepta únicamente transferencias.");return Views.Payment(await payments.Create(Current,r,Key));}
    [HttpPost("transactions/national-remittance"),Authorize(Policy="transactions.create"),EnableRateLimiting("financial")]
    public async Task<object> NationalRemittance(PaymentRequest r){if(r.Kind!="giro")throw new BusinessException("El endpoint acepta únicamente giros nacionales.");return Views.Payment(await payments.Create(Current,r,Key));}
    [HttpPost("payments/{id:guid}/review"),Authorize(Policy="transactions.settle"),EnableRateLimiting("financial")]
    public async Task<object> Review(Guid id,ReviewRequest r)=>Views.Payment(await payments.Review(Current,id,r));
    [HttpGet("topups"),Authorize(Policy="topups.read")]
    public async Task<object> TopUps(int page=1,string? kind=null){if(page<1||page>10000)throw new BusinessException("Página inválida.");if(kind!=null&&kind is not("RecargaSaldo" or "EfectivoMovil" or "Deuna"))throw new BusinessException("Tipo de recarga fuera del alcance.");var q=access.TopUps(Current).AsNoTracking();if(kind!=null)q=q.Where(t=>t.Kind==kind);var items=await q.OrderByDescending(t=>t.CreatedAt).Skip((page-1)*20).Take(20).ToListAsync();var owners=await db.Users.AsNoTracking().Where(u=>items.Select(t=>t.UserId).Contains(u.Id)).Select(u=>new{u.Id,u.Name,u.Email}).ToDictionaryAsync(u=>u.Id);var canReview=Current.Permissions.Contains("topups.approve");return new{total=await q.CountAsync(),items=items.Select(t=>new{t.Id,t.UserId,userName=owners.GetValueOrDefault(t.UserId)?.Name,userEmail=owners.GetValueOrDefault(t.UserId)?.Email,t.Kind,t.Amount,t.Bank,t.Reference,t.DepositorName,t.SenderName,t.TransactionReference,t.PhoneNumber,t.BeneficiaryName,t.Status,statusCode=t.Status switch{"Pendiente"=>"PENDING","Aprobada"=>"APPROVED","Rechazada"=>"REJECTED",_=>t.Status},t.CreatedAt,t.ReviewNote,withdrawalCode=canReview&&t.Status=="Pendiente"&&!string.IsNullOrEmpty(t.ProtectedWithdrawalCode)?vault.Unprotect(t.ProtectedWithdrawalCode):null,beneficiaryCode=canReview&&t.Status=="Pendiente"&&!string.IsNullOrEmpty(t.ProtectedBeneficiaryCode)?vault.Unprotect(t.ProtectedBeneficiaryCode):null})};}
    [HttpPost("topups"),Authorize(Policy="topups.create"),EnableRateLimiting("financial")]
    public async Task<object> TopUp(TopUpRequest r){var t=await topups.Create(Current,r,Key);return new{t.Id,t.Kind,t.Amount,t.Bank,t.Reference,t.Status,statusCode="PENDING",t.CreatedAt};}
    [HttpPost("topups/{id:guid}/review"),Authorize(Policy="topups.approve"),EnableRateLimiting("financial")]
    public async Task<object> ReviewTopUp(Guid id,TopUpReview r){var t=await topups.Review(Current,id,r);return new{t.Id,t.Status,statusCode=t.Status switch{"Aprobada"=>"APPROVED","Rechazada"=>"REJECTED",_=>"PENDING"}};}
    private static (DateTimeOffset? Start,DateTimeOffset? End) Dates(DateOnly? from,DateOnly? to){if(from>to||from?.Year<2000||to?.Year>2100)throw new BusinessException("Rango de fechas inválido.");return(from.HasValue?new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue),TimeSpan.FromHours(-5)).ToUniversalTime():null,to.HasValue?new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue),TimeSpan.FromHours(-5)).ToUniversalTime():null);}
}
