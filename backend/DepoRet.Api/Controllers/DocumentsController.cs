using DepoRet.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace DepoRet.Api.Controllers;
[Route("api")]
public sealed class DocumentsController(IAppDb db,AccessService access,ISecretVault vault,IPdfReports pdf):AppController
{
    [HttpGet("credit/reports/{id:guid}/pdf"),Authorize(Policy="credit.request"),EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Credit(Guid id){
        var user=Current.Id;var report=await db.CreditReports.AsNoTracking().SingleOrDefaultAsync(r=>r.Id==id&&r.UserId==user)??throw new Domain.BusinessException("Reporte no encontrado.",404);
        if(report.Status!="Completado"||report.ReportJson==null)throw new Domain.BusinessException("El reporte aún no está disponible.",409);
        var bytes=pdf.Credit(report,vault.Unprotect(report.ProtectedDocument),vault.Unprotect(report.ReportJson));
        db.Record(user,"credit.pdf.downloaded",id.ToString());await db.SaveChangesAsync();
        return File(bytes,"application/pdf",$"deporet-equifax-{id:N}.pdf");
    }
    [HttpGet("payments/{id:guid}/receipt"),Authorize(Policy="transactions.read"),EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Receipt(Guid id){var payment=await access.Payments(Current).AsNoTracking().SingleOrDefaultAsync(p=>p.Id==id)??throw new Domain.BusinessException("Operación no encontrada.",404);return File(pdf.Receipt(payment),"application/pdf",$"deporet-constancia-{id:N}.pdf");}
}
