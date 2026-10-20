using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DepoRet.Application;
using DepoRet.Domain;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using SkiaSharp;
namespace DepoRet.Infrastructure;

public class SecretVault(IDataProtectionProvider provider):ISecretVault
{
    private readonly IDataProtector protector=provider.CreateProtector("DepoRet.Secrets.v1");
    public string Protect(string value)=>protector.Protect(value);
    public string Unprotect(string value)=>protector.Unprotect(value);
}
public class CreditProvider(IConfiguration config,ISecretVault vault):ICreditProvider
{
    public async Task ValidateEndpoint(string endpoint,CancellationToken ct){
        if(!Uri.TryCreate(endpoint,UriKind.Absolute,out var uri)||uri.Scheme!="https"||!string.IsNullOrEmpty(uri.UserInfo)||!string.IsNullOrEmpty(uri.Fragment)||uri.Port!=443||IPAddress.TryParse(uri.Host,out _))throw new BusinessException("El endpoint debe ser HTTPS con hostname y puerto 443.");
        var allowed=config.GetSection("Equifax:AllowedHosts").Get<string[]>()??[];
        if(!allowed.Contains(uri.IdnHost,StringComparer.OrdinalIgnoreCase))throw new BusinessException("El dominio no está en Equifax:AllowedHosts del despliegue.");
        var addresses=await Dns.GetHostAddressesAsync(uri.DnsSafeHost,ct);if(addresses.Length==0||addresses.Any(a=>!PublicAddress(a)))throw new BusinessException("El endpoint no puede resolver a redes privadas o reservadas.");
    }
    public static bool PublicAddress(IPAddress ip){if(ip.IsIPv4MappedToIPv6)ip=ip.MapToIPv4();if(IPAddress.IsLoopback(ip)||ip.Equals(IPAddress.Any)||ip.Equals(IPAddress.IPv6Any)||ip.IsIPv6LinkLocal||ip.IsIPv6Multicast||ip.IsIPv6SiteLocal)return false;var b=ip.GetAddressBytes();if(b.Length==16)return (b[0]&0xe0)==0x20;return !(b[0] is 0 or 10 or 127||b[0]>=224||b[0]==169&&b[1]==254||b[0]==172&&b[1]>=16&&b[1]<=31||b[0]==192&&(b[1]==168||b[1]==0)||b[0]==100&&b[1]>=64&&b[1]<=127||b[0]==198&&(b[1]==18||b[1]==19));}
    public async Task<int> Probe(string endpoint,CancellationToken ct)
    {
        await ValidateEndpoint(endpoint,ct);var uri=new Uri(endpoint);
        using var handler=new SocketsHttpHandler{AllowAutoRedirect=false,UseProxy=false,ConnectCallback=async(context,token)=>{
            if(!context.DnsEndPoint.Host.Equals(uri.IdnHost,StringComparison.OrdinalIgnoreCase))throw new HttpRequestException("Host no autorizado.");
            var addresses=await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host,token);if(addresses.Length==0||addresses.Any(a=>!PublicAddress(a)))throw new HttpRequestException("Dirección no pública.");
            var socket=new Socket(SocketType.Stream,ProtocolType.Tcp);try{await socket.ConnectAsync(addresses,443,token);return new NetworkStream(socket,ownsSocket:true);}catch{socket.Dispose();throw;}
        }};
        using var client=new HttpClient(handler){Timeout=TimeSpan.FromSeconds(10)};
        using var response=await client.SendAsync(new HttpRequestMessage(HttpMethod.Head,uri.GetLeftPart(UriPartial.Authority)),HttpCompletionOption.ResponseHeadersRead,ct);
        if((int)response.StatusCode>=500)throw new BusinessException("El endpoint Equifax respondió con error de servidor.",502);
        return (int)response.StatusCode;
    }
    public async Task<string> Fetch(IntegrationSettings s,CreditReport report,string document,CancellationToken ct)
    {
        if(s.Mode=="Sandbox")return JsonSerializer.Serialize(new{
            simulated=true,disclaimer="REPORTE FICTICIO DE PRUEBA. No procede de Equifax y no permite evaluar a una persona real.",score=742,scoreRange="1-999",risk="Ejemplo: bajo",subject="Titular ficticio de demostración",generatedAt=DateTimeOffset.UtcNow,
            summary=new{activeAccounts=2,directObligations=2450.75m,indirectObligations=0m,totalDebt=2450.75m,overdue=0m,onTimePayments=100,maxDaysPastDue=0,inquiries12m=1},
            entities=new[]{new{institution="Entidad financiera DEMO A",product="Crédito de consumo",direct=1840.25m,indirect=0m,overdue=0m,balance=1840.25m,status="Al día",share=75.09m},new{institution="Entidad financiera DEMO B",product="Tarjeta de crédito",direct=610.50m,indirect=0m,overdue=0m,balance=610.50m,status="Al día",share=24.91m}},
            delinquency=Enumerable.Range(0,12).Select(i=>new{period=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).AddMonths(-i).ToString("yyyy-MM"),d30=0m,d60=0m,d90=0m,d120=0m}).ToArray()
        });
        await ValidateEndpoint(s.Endpoint,ct);var uri=new Uri(s.Endpoint);
        using var handler=new SocketsHttpHandler{AllowAutoRedirect=false,UseProxy=false,ConnectCallback=async(context,token)=>{
            if(!context.DnsEndPoint.Host.Equals(uri.IdnHost,StringComparison.OrdinalIgnoreCase))throw new HttpRequestException("Host no autorizado.");
            var addresses=await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host,token);if(addresses.Any(a=>!PublicAddress(a)))throw new HttpRequestException("Dirección no pública.");
            var socket=new Socket(SocketType.Stream,ProtocolType.Tcp);try{await socket.ConnectAsync(addresses,443,token);return new NetworkStream(socket,ownsSocket:true);}catch{socket.Dispose();throw;}
        }};
        using var client=new HttpClient(handler){Timeout=TimeSpan.FromSeconds(20)};
        var payload=s.RequestTemplate.Replace("{{document}}",document).Replace("{{type}}",report.DocumentType).Replace("{{requestId}}",report.Id.ToString());
        using var request=new HttpRequestMessage(HttpMethod.Post,uri){Content=new StringContent(payload,Encoding.UTF8,"application/json")};
        request.Headers.Add(s.ApiKeyHeader,vault.Unprotect(s.ProtectedApiKey));if(!string.IsNullOrEmpty(s.ProtectedClientId))request.Headers.Add(s.ClientIdHeader,vault.Unprotect(s.ProtectedClientId));if(!string.IsNullOrEmpty(s.ProtectedClientSecret))request.Headers.Add(s.SecretHeader,vault.Unprotect(s.ProtectedClientSecret));request.Headers.Add("Idempotency-Key",report.Id.ToString());
        using var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,ct);response.EnsureSuccessStatusCode();
        if(response.Content.Headers.ContentLength>1024*1024)throw new HttpRequestException("Reporte demasiado grande.");
        await using var stream=await response.Content.ReadAsStreamAsync(ct);using var memory=new MemoryStream();var buffer=new byte[8192];int read;while((read=await stream.ReadAsync(buffer,ct))>0){if(memory.Length+read>1024*1024)throw new HttpRequestException("Reporte demasiado grande.");memory.Write(buffer,0,read);}
        using var json=JsonDocument.Parse(memory.ToArray());var score=json.RootElement;foreach(var part in s.ScorePath.Split('.'))score=score.GetProperty(part);
        if(!score.TryGetInt32(out var value)||value<0||value>999)throw new HttpRequestException("Respuesta incompatible con el score configurado.");
        // Do not persist arbitrary provider payloads or expose additional personal data accidentally.
        return JsonSerializer.Serialize(new{simulated=false,score=value,generatedAt=DateTimeOffset.UtcNow,subject="Reporte del documento autorizado",disclaimer="Reporte recibido del endpoint contratado; verificar alcance del producto y escala con el proveedor."});
    }
}
public class AvatarValidator:IAvatarValidator
{
    public Task<(byte[] Data,string Mime)> Validate(byte[] data,string mime,string filename,CancellationToken ct)
    {
        if(data.Length==0||data.Length>2*1024*1024)throw new BusinessException("La imagen debe pesar como máximo 2 MB.");
        var ext=Path.GetExtension(filename).ToLowerInvariant();
        var actual=data.Length>=8&&data.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10})?"image/png":data.Length>=12&&Encoding.ASCII.GetString(data,0,4)=="RIFF"&&Encoding.ASCII.GetString(data,8,4)=="WEBP"?"image/webp":data.Length>=4&&data[0]==255&&data[1]==216&&data[2]==255&&data[^2]==255&&data[^1]==217?"image/jpeg":"";
        if(actual==""||actual!=mime||!(actual=="image/jpeg"&&ext is ".jpg" or ".jpeg"||actual=="image/png"&&ext==".png"||actual=="image/webp"&&ext==".webp"))throw new BusinessException("Archivo inválido: usa JPG, PNG o WebP con firma y MIME coincidentes.");
        using var encoded=SKData.CreateCopy(data);using var codec=SKCodec.Create(encoded);
        if(codec==null||codec.Info.Width<1||codec.Info.Height<1||codec.Info.Width>4096||codec.Info.Height>4096||(long)codec.Info.Width*codec.Info.Height>16000000)throw new BusinessException("Imagen inválida o dimensiones demasiado grandes (máximo 4096 px).");
        using var bitmap=SKBitmap.Decode(codec);if(bitmap==null)throw new BusinessException("No se pudo decodificar la imagen.");
        using var scaled=bitmap.Resize(new SKImageInfo(256,256),new SKSamplingOptions(SKFilterMode.Linear));
        if(scaled==null)throw new BusinessException("No se pudo procesar la imagen.");
        using var image=SKImage.FromBitmap(scaled);using var png=image.Encode(SKEncodedImageFormat.Png,90);
        return Task.FromResult((png.ToArray(),"image/png"));
    }
}
