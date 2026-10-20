using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using DepoRet.Domain;
using DepoRet.Application;
using DepoRet.Infrastructure;
using DepoRet.Api.Realtime;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

var builder=WebApplication.CreateBuilder(args);var config=builder.Configuration;
if(config["Security:SecretDirectory"] is string secretDirectory){
    string ReadSecret(string name)=>File.ReadAllText(Path.Combine(secretDirectory,name)).Trim();
    config["Auth:SigningKey"]=ReadSecret("jwt-key");config["Sandbox:Password"]=ReadSecret("sandbox-password");
    config["Bootstrap:Password"]=ReadSecret("bootstrap-password");
    var connection=new NpgsqlConnectionStringBuilder(config.GetConnectionString("Database")){Password=ReadSecret("db-password")};config["ConnectionStrings:Database"]=connection.ConnectionString;
}
if(config["Payments:Mode"] is not("Sandbox" or "Manual"))throw new InvalidOperationException("Payments:Mode debe ser Sandbox o Manual.");
var secret=config["Auth:SigningKey"]??throw new InvalidOperationException("Configura Auth__SigningKey.");if(secret.Length<48)throw new InvalidOperationException("La clave JWT debe tener al menos 48 caracteres.");
if(config.GetValue<decimal>("Fiscal:VatRate") is <0 or >1)throw new InvalidOperationException("IVA inválido.");
builder.WebHost.ConfigureKestrel(o=>o.Limits.MaxRequestBodySize=6*1024*1024);
builder.Services.AddDbContext<DepoDb>(o=>o.UseNpgsql(config.GetConnectionString("Database")));
builder.Services.AddScoped<IAppDb>(s=>s.GetRequiredService<DepoDb>());
builder.Services.AddSingleton<IPdfReports,PdfReports>();
builder.Services.AddScoped<AccessService>();builder.Services.AddScoped<PaymentService>();builder.Services.AddScoped<TopUpService>();builder.Services.AddScoped<IdentityService>();builder.Services.AddScoped<CreditService>();
builder.Services.AddSingleton<IPasswordHasher<User>,PasswordHasher<User>>();builder.Services.AddSingleton<IAvatarValidator,AvatarValidator>();builder.Services.AddSingleton<ISecretVault,SecretVault>();builder.Services.AddSingleton<ICreditProvider,CreditProvider>();
var keyPath=config["Security:KeyPath"]??Path.Combine(builder.Environment.ContentRootPath,".keys");Directory.CreateDirectory(keyPath);
builder.Services.AddDataProtection().SetApplicationName("DepoRet").PersistKeysToFileSystem(new DirectoryInfo(keyPath));
builder.Services.AddControllers().ConfigureApiBehaviorOptions(o=>o.InvalidModelStateResponseFactory=c=>new BadRequestObjectResult(new{message="Revisa los campos requeridos y sus formatos.",errors=c.ModelState.Where(x=>x.Value?.Errors.Count>0).ToDictionary(x=>x.Key,x=>x.Value!.Errors.Select(e=>e.ErrorMessage))}));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o=>{
    o.TokenValidationParameters=new(){ValidateIssuer=true,ValidIssuer="deporet",ValidateAudience=true,ValidAudience="deporet-web",ValidateLifetime=true,ValidateIssuerSigningKey=true,IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),ClockSkew=TimeSpan.FromSeconds(10)};
    o.Events=new(){OnMessageReceived=ctx=>{if(ctx.HttpContext.Request.Path.StartsWithSegments("/api/events")){var token=ctx.Request.Query["access_token"];if(!string.IsNullOrEmpty(token))ctx.Token=token;}return Task.CompletedTask;},OnTokenValidated=async ctx=>{
        var db=ctx.HttpContext.RequestServices.GetRequiredService<DepoDb>();var principal=ctx.Principal!;
        if(!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier),out var id)){ctx.Fail("Sesión inválida.");return;}
        var auth=await (from u in db.Users.AsNoTracking() join r in db.Roles.AsNoTracking() on u.Role equals r.Name where u.Id==id select new{u.Active,u.SecurityVersion,u.Role,r.Version}).SingleOrDefaultAsync();
        if(auth==null||!auth.Active||auth.Role!=principal.FindFirstValue(ClaimTypes.Role)||auth.SecurityVersion.ToString()!=principal.FindFirstValue("ver")||auth.Version.ToString()!=principal.FindFirstValue("rver"))ctx.Fail("Sesión revocada.");
    }};
});
builder.Services.AddAuthorization(o=>{foreach(var p in PermissionCatalog.All)o.AddPolicy(p,policy=>policy.RequireAuthenticatedUser().RequireClaim("permission",p));});
builder.Services.AddSignalR(o=>{o.MaximumReceiveMessageSize=4096;o.EnableDetailedErrors=false;});builder.Services.AddHostedService<OutboxDispatcher>();
builder.Services.AddRateLimiter(o=>{
    o.RejectionStatusCode=429;
    o.AddPolicy("login",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new(){PermitLimit=20,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
    o.AddPolicy("financial",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)??"anonymous",_=>new(){PermitLimit=30,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
    o.AddPolicy("sensitive",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)??"anonymous",_=>new(){PermitLimit=8,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
    o.GlobalLimiter=PartitionedRateLimiter.Create<HttpContext,string>(ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new(){PermitLimit=600,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
});
var app=builder.Build();
app.Use(async(ctx,next)=>{
    ctx.Response.Headers["X-Content-Type-Options"]="nosniff";ctx.Response.Headers["X-Frame-Options"]="DENY";ctx.Response.Headers["Referrer-Policy"]="same-origin";ctx.Response.Headers["Cache-Control"]="no-store";
    ctx.Response.Headers["Content-Security-Policy"]="default-src 'none'; frame-ancestors 'none'";
    if(ctx.Request.IsHttps)ctx.Response.Headers["Strict-Transport-Security"]="max-age=31536000; includeSubDomains";
    // No cookies are used for authentication. Reject cross-origin WebSocket handshakes as well.
    if(ctx.Request.Path.StartsWithSegments("/api/events")&&ctx.Request.Headers.TryGetValue("Origin",out var origin)&&!(config.GetSection("Security:AllowedOrigins").Get<string[]>()??[]).Contains(origin.ToString(),StringComparer.OrdinalIgnoreCase)){ctx.Response.StatusCode=403;return;}
    try{await next();}
    catch(BusinessException e){ctx.Response.StatusCode=e.Status;await ctx.Response.WriteAsJsonAsync(new{message=e.Message});}
    catch(DbUpdateException e) when(e.InnerException is PostgresException{SqlState:"23505"}){ctx.Response.StatusCode=409;await ctx.Response.WriteAsJsonAsync(new{message="El registro o referencia ya existe."});}
    catch(OperationCanceledException) when(ctx.RequestAborted.IsCancellationRequested){}
    catch(Exception e){app.Logger.LogError(e,"Fallo interno {TraceId}",ctx.TraceIdentifier);ctx.Response.StatusCode=500;await ctx.Response.WriteAsJsonAsync(new{message="No se pudo completar la solicitud.",traceId=ctx.TraceIdentifier});}
});
app.UseAuthentication();app.UseRateLimiter();app.UseAuthorization();
app.MapControllers();app.MapHub<AccountHub>("/api/events",o=>o.CloseOnAuthenticationExpiration=true).RequireAuthorization();
app.MapGet("/api/health",async(DepoDb db)=>await db.Database.CanConnectAsync()?Results.Ok(new{status="ok",mode=config["Payments:Mode"]}):Results.StatusCode(503));
if(config.GetValue<bool>("Database:MigrateOnStartup")){await using var scope=app.Services.CreateAsyncScope();var db=scope.ServiceProvider.GetRequiredService<DepoDb>();await db.Database.MigrateAsync();await Seed.Run(db,scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>(),config);}
app.Run();
public partial class Program{}
