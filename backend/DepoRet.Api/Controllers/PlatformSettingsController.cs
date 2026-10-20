using DepoRet.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace DepoRet.Api.Controllers;

[Route("api/settings/deuna-qr")]
public sealed class PlatformSettingsController(IAppDb db) : AppController
{
    [HttpGet("status"), Authorize(Policy = "integrations.manage")]
    public async Task<object> Status()
    {
        var settings = await db.Platform.AsNoTracking().SingleAsync(x => x.Id == "platform");
        return new { configured = settings.DeunaQrFile is not null, settings.DeunaQrFileName, settings.UpdatedAt };
    }

    [HttpGet, Authorize(Policy = "transactions.create")]
    public async Task<IActionResult> GetQr()
    {
        var settings = await db.Platform.AsNoTracking().SingleAsync(x => x.Id == "platform");
        if (settings.DeunaQrFile is null || settings.DeunaQrMime is null) return NotFound();
        return File(settings.DeunaQrFile, settings.DeunaQrMime, enableRangeProcessing: false);
    }

    [HttpPut, Authorize(Policy = "integrations.manage"), EnableRateLimiting("sensitive")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<object> Upload([FromForm] IFormFile file, CancellationToken ct)
    {
        if (!Current.Admin) throw new Domain.BusinessException("Solo el administrador puede actualizar el QR de cobro.", 403);
        if (file.Length is <= 0 or > 5 * 1024 * 1024) throw new Domain.BusinessException("El archivo debe tener hasta 5 MB.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var mime = file.ContentType.ToLowerInvariant();
        if (extension is not (".png" or ".jpg" or ".jpeg" or ".pdf") || mime is not ("image/png" or "image/jpeg" or "application/pdf"))
            throw new Domain.BusinessException("Usa un archivo PNG, JPG o PDF.");
        await using var stream = new MemoryStream(); await file.CopyToAsync(stream, ct); var bytes = stream.ToArray();
        var valid = mime == "image/png" ? bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })
            : mime == "image/jpeg" ? bytes.Length >= 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255
            : bytes.AsSpan().StartsWith("%PDF-"u8);
        if (!valid) throw new Domain.BusinessException("La firma del archivo no coincide con su tipo.");
        var settings = await db.Platform.SingleAsync(x => x.Id == "platform", ct);
        settings.DeunaQrFile = bytes; settings.DeunaQrMime = mime; settings.DeunaQrFileName = Path.GetFileName(file.FileName);
        settings.UpdatedAt = DateTimeOffset.UtcNow; settings.UpdatedBy = Current.Id;
        db.Record(Current.Id, "platform.deuna_qr.updated", settings.DeunaQrFileName);
        await db.SaveChangesAsync(ct);
        return new { message = "Código QR de Deuna actualizado.", settings.UpdatedAt };
    }
}
