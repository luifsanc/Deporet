using System.Security.Claims;
using DepoRet.Application;
using DepoRet.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace DepoRet.Api.Controllers;
[ApiController,Authorize]
public abstract class AppController:ControllerBase
{
    protected Actor Current=>new(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),User.FindFirstValue("baseRole")!,User.FindAll("permission").Select(c=>c.Value).ToArray());
    protected string Key=>Request.Headers["Idempotency-Key"].ToString();
}
public static class Views
{
    public static object User(User u,string baseRole,string[] permissions)=>new{u.Id,u.Name,u.Email,u.Role,roleLabel=baseRole==Roles.Executive?"Operador":baseRole,baseRole,u.Active,u.KycVerified,u.Phone,u.AssignedExecutiveId,hasAvatar=u.Avatar!=null,permissions};
    public static object Payment(Payment p)=>new{p.Id,p.UserId,p.Kind,p.Recipient,p.BeneficiaryName,p.DocumentType,documentNumberMasked=p.DocumentNumber.Length>4?new string('*',p.DocumentNumber.Length-4)+p.DocumentNumber[^4..]:"",p.BankName,p.AccountType,accountNumberMasked=p.AccountNumber.Length>4?"••••"+p.AccountNumber[^4..]:"",p.DeliveryMethod,p.Reference,p.Note,p.Amount,p.Fee,p.Tax,p.TaxRate,p.TaxRule,p.Total,p.Status,statusCode=p.Status switch{"Procesando"=>"PENDING","Liquidada"=>"APPROVED","Rechazada"=>"REJECTED",_=>p.Status},p.CreatedAt,p.ProviderReference,p.ReviewedAt,p.ReviewNote,currency="USD",simulated=p.Simulated};
}
