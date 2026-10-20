using DepoRet.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace DepoRet.Api.Controllers;
[Route("api")]
public class CreditController(IAppDb db,CreditService credit,ICreditProvider provider,IConfiguration config):AppController
{
    [HttpPost("credit/reports"),Authorize(Policy="credit.request"),EnableRateLimiting("financial")]
    public async Task<object> RequestReport(CreditQuery r,CancellationToken ct)=>credit.View(await credit.Request(Current,r,Key,ct));
    [HttpGet("credit/reports"),Authorize(Policy="credit.request")]
    public async Task<object> Reports(){var id=Current.Id;return(await db.CreditReports.AsNoTracking().Where(r=>r.UserId==id).OrderByDescending(r=>r.CreatedAt).Take(20).ToListAsync()).Select(credit.View);}
    [HttpGet("integrations/equifax"),Authorize(Policy="integrations.manage")]
    public async Task<object> Settings(){var s=await db.Integrations.AsNoTracking().SingleAsync(s=>s.Id=="equifax");return new{s.Mode,s.Enabled,s.Endpoint,hasClientId=s.ProtectedClientId!="",hasApiKey=s.ProtectedApiKey!="",hasClientSecret=s.ProtectedClientSecret!="",s.RequestTemplate,s.ScorePath,s.ApiKeyHeader,s.ClientIdHeader,s.SecretHeader,s.ContractVerified,s.UpdatedAt};}
    [HttpPut("integrations/equifax"),Authorize(Policy="integrations.manage"),EnableRateLimiting("sensitive")]
    public async Task<object> Save(IntegrationChange r,CancellationToken ct){await credit.SaveSettings(Current,r,ct);return new{message="Configuración guardada. Las credenciales se almacenaron cifradas."};}
    [HttpPost("integrations/equifax/test"),Authorize(Policy="integrations.manage"),EnableRateLimiting("sensitive")]
    public async Task<object> TestConnection(CancellationToken ct){if(!Current.Admin)throw new Domain.BusinessException("Solo el administrador puede validar la integración.",403);var s=await db.Integrations.AsNoTracking().SingleAsync(s=>s.Id=="equifax");if(s.Mode=="Sandbox")return new{reachable=true,httpStatus=(int?)null,message="Sandbox local habilitado; no se contactó a Equifax."};if(string.IsNullOrWhiteSpace(s.Endpoint))throw new Domain.BusinessException("Configura primero el endpoint de Equifax.");var status=await provider.Probe(s.Endpoint,ct);return new{reachable=true,httpStatus=(int?)status,message="El host HTTPS respondió. Esta prueba no envía credenciales ni valida el contrato comercial."};}
    [HttpGet("settings"),Authorize(Policy="integrations.manage")]
    public async Task<object> General()=>new{mode=config["Payments:Mode"],currency="USD",timezone="America/Guayaquil",fiscal=new{vatRate=config.GetValue<decimal>("Fiscal:VatRate"),ruleVersion=config["Fiscal:RuleVersion"]??"Validar tratamiento tributario"},limits=new{daily=config.GetValue<decimal>("Payments:DailyLimit"),reviewFrom=0},roles=await db.Roles.Select(r=>new{r.Name,r.BaseRole}).ToListAsync(),integrations=new[]{new{name="Equifax",status=(await db.Integrations.SingleAsync(s=>s.Id=="equifax")).Mode}}};
}
