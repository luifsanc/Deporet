using System.ComponentModel.DataAnnotations;
using System.Reflection;
using DepoRet.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
namespace DepoRet.Application;

public interface IAppDb
{
    DbSet<User> Users { get; }
    DbSet<Account> Accounts { get; }
    DbSet<Payment> Payments { get; }
    DbSet<LedgerEntry> Ledger { get; }
    DbSet<AuditEvent> Audit { get; }
    DbSet<CreditRequest> CreditRequests { get; }
    DbSet<RoleDefinition> Roles { get; }
    DbSet<PermissionDefinition> Permissions { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<TopUp> TopUps { get; }
    DbSet<IntegrationSettings> Integrations { get; }
    DbSet<PlatformSettings> Platform { get; }
    DbSet<CreditReport> CreditReports { get; }
    DbSet<OutboxEvent> Outbox { get; }
    DatabaseFacade Database { get; }
    Task<int> SaveChangesAsync(CancellationToken ct=default);
    void Record(Guid? actor,string action,string resource);
    void Notify(Guid user,string eventType);
}
public interface ISecretVault { string Protect(string value); string Unprotect(string value); }
public interface ICreditProvider { Task<string> Fetch(IntegrationSettings settings,CreditReport report,string document,CancellationToken ct); Task ValidateEndpoint(string endpoint,CancellationToken ct); Task<int> Probe(string endpoint,CancellationToken ct); }
public interface IAvatarValidator { Task<(byte[] Data,string Mime)> Validate(byte[] data,string mime,string filename,CancellationToken ct); }
public interface IPdfReports { byte[] Credit(CreditReport report,string document,string json); byte[] Receipt(Payment payment); }
public record Actor(Guid Id,string BaseRole,string[] Permissions)
{
    public bool Admin=>BaseRole==Roles.Admin;
    public bool Executive=>BaseRole==Roles.Executive;
    public bool Client=>BaseRole==Roles.Client;
    public void Demand(string permission){if(!Permissions.Contains(permission))throw new BusinessException("No tienes permiso para esta acción.",403);}
}
public static class Validation
{
    public static void Check(object model){
        var errors=new List<ValidationResult>();Validator.TryValidateObject(model,new ValidationContext(model),errors,true);
        var constructor=model.GetType().GetConstructors().OrderByDescending(c=>c.GetParameters().Length).FirstOrDefault();
        foreach(var parameter in constructor?.GetParameters()??[]){var property=model.GetType().GetProperty(parameter.Name!);if(property!=null)Validator.TryValidateValue(property.GetValue(model),new ValidationContext(model){MemberName=property.Name},errors,parameter.GetCustomAttributes<ValidationAttribute>());}
        if(errors.Count>0)throw new BusinessException(string.Join(" ",errors.Select(e=>e.ErrorMessage)));
    }
    public static string Key(string key)=>Guid.TryParse(key,out var id)?id.ToString():throw new BusinessException("Se requiere una clave UUID de idempotencia.");
    public static decimal Money(decimal v)=>decimal.Round(v,2,MidpointRounding.AwayFromZero);
    public static void Amount(decimal v,decimal max){if(v<=0||v>max||Money(v)!=v)throw new BusinessException($"Monto inválido: máximo {max:0.00} USD y dos decimales.");}
    public static DateTimeOffset DayStart()=>new DateTimeOffset(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).Date,TimeSpan.FromHours(-5)).ToUniversalTime();
    public static bool EcuadorianId(string value)
    {
        if(value.Length!=10||!value.All(char.IsDigit))return false;
        var province=int.Parse(value[..2]);if(province is <1 or >24||value[2]>'5')return false;
        var sum=0;for(var i=0;i<9;i++){var n=value[i]-'0';if(i%2==0){n*=2;if(n>9)n-=9;}sum+=n;}
        return (10-sum%10)%10==value[9]-'0';
    }
}
public record LoginRequest([Required,EmailAddress,MaxLength(254)]string Email,[Required,MaxLength(256)]string Password);
public record PaymentRequest([Required,MaxLength(30)]string Kind,decimal Amount,[MaxLength(120)]string? Recipient=null,[MaxLength(80)]string? Reference=null,[MaxLength(200)]string? Note=null,bool AcceptCharges=false,
    [MaxLength(120)]string? BeneficiaryName=null,[MaxLength(13)]string? DocumentType=null,[MaxLength(13)]string? DocumentNumber=null,[MaxLength(100)]string? BankName=null,
    [MaxLength(20)]string? AccountType=null,[MaxLength(12)]string? AccountNumber=null,[MaxLength(40)]string? DeliveryMethod=null);
public record ReviewRequest(bool Approve,[Required,MaxLength(200)]string Reason,[MaxLength(100)]string? BankReference,bool ConfirmExecuted);
public record TopUpRequest(decimal Amount,[MaxLength(80)]string Bank="",[MaxLength(100)]string Reference="",[MaxLength(30)]string Kind="RecargaSaldo",
    [MaxLength(120)]string? DepositorName=null,[MaxLength(120)]string? SenderName=null,[MaxLength(100)]string? TransactionReference=null,
    [MaxLength(10)]string? PhoneNumber=null,[MaxLength(120)]string? BeneficiaryName=null,[MaxLength(32)]string? WithdrawalCode=null,[MaxLength(32)]string? BeneficiaryCode=null);
public record TopUpReview(bool Approve,[Required,MaxLength(200)]string Reason);
public record UserCreate([Required,MaxLength(100)]string Name,[Required,EmailAddress,MaxLength(254)]string Email,[Required,MinLength(12),MaxLength(128)]string Password,[Required,MaxLength(50)]string Role,Guid? AssignedExecutiveId);
public record UserChange([Required,MaxLength(50)]string Role,bool Active,Guid? AssignedExecutiveId,bool KycVerified);
public record ProfileChange([Required,MaxLength(100)]string Name,[RegularExpression(@"^$|^\+?[0-9]{7,15}$")]string Phone);
public record PasswordChange([Required,MaxLength(256)]string CurrentPassword,[Required,MinLength(12),MaxLength(128)]string NewPassword);
public record RoleChange([Required,RegularExpression(@"^[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-z0-9ÁÉÍÓÚáéíóúÑñ_-]{2,49}$")]string Name,[Required,MaxLength(80)]string DisplayName,[Required]string BaseRole,[Required,MaxLength(30)]string[] Permissions);
public record CreditQuery([Required,RegularExpression(@"^\d{10}$|^\d{13}$")]string Document,bool Accepted,[Required]string ConsentVersion);
public record IntegrationChange([Required]string Mode,[MaxLength(1000)]string Endpoint,[MaxLength(4000)]string? ClientId,[MaxLength(4000)]string? ApiKey,[MaxLength(4000)]string? ClientSecret,bool ClearSecrets,[Required,MaxLength(4000)]string RequestTemplate,[Required,RegularExpression(@"^[A-Za-z0-9_.]{1,100}$")]string ScorePath,[Required,RegularExpression(@"^[A-Za-z0-9-]{1,60}$")]string ApiKeyHeader,[Required,RegularExpression(@"^[A-Za-z0-9-]{1,60}$")]string SecretHeader,bool ContractVerified,bool Enabled=false,[Required,RegularExpression(@"^[A-Za-z0-9-]{1,60}$")]string ClientIdHeader="X-Client-Id");
public record ServiceDefinition(string Id,string Name,string Description,string Icon,decimal Fee,decimal Limit);
public record Quote(decimal Amount,decimal Fee,decimal Tax,decimal TaxRate,decimal Total,string TaxRule,bool RequiresReview);
public static class Catalog
{
    public static readonly string[] Banks=["Banco Pichincha","Banco Guayaquil","Banco del Pacífico","Produbanco","Banco Bolivariano","Banco Internacional","Banco del Austro","Banco Diners Club","Banco General Rumiñahui","Banco de Loja","Banco de Machala","Banco Solidario","Banco ProCredit","Banco CoopNacional","Banco VisionFund Ecuador","Banco D-Miro","Banco Finca","Banco Litoral","DelBank","Banco Capital","Banco Desarrollo","BanEcuador"];
    public static readonly ServiceDefinition[] Services=[new("transferencia","Transferencias","Envía a cuentas bancarias reguladas en Ecuador","arrows",.45m,5000m),new("giro","Giros nacionales","Envía a una cuenta o habilita retiro en ventanilla","send",.45m,3000m)];
    public static Quote Price(string kind,decimal amount,decimal rate,string rule){var s=Services.FirstOrDefault(s=>s.Id==kind)??throw new BusinessException("Solo se admiten transferencias y giros nacionales en este flujo.");Validation.Amount(amount,s.Limit);var tax=Validation.Money(s.Fee*rate);return new(amount,s.Fee,tax,rate,amount+s.Fee+tax,rule,true);}
}
