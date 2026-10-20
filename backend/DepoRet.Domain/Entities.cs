namespace DepoRet.Domain;
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = Roles.Client;
    public bool Active { get; set; } = true;
    public bool KycVerified { get; set; }
    public Guid? AssignedExecutiveId { get; set; }
    public long SecurityVersion { get; set; }
    public int FailedLogins { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public string Phone { get; set; } = "";
    public byte[]? Avatar { get; set; }
    public string? AvatarMime { get; set; }
}
public class Account
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public decimal Balance { get; set; }
    public decimal Reserved { get; set; }
    public string Currency { get; set; } = "USD";
}
public class Payment
{
    public bool Simulated { get; set; } = true;
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Kind { get; set; } = "";
    public string Recipient { get; set; } = "";
    public string BeneficiaryName { get; set; } = "";
    public string DocumentType { get; set; } = "";
    public string DocumentNumber { get; set; } = "";
    public string BankName { get; set; } = "";
    public string AccountType { get; set; } = "";
    public string AccountNumber { get; set; } = "";
    public string DeliveryMethod { get; set; } = "";
    public string Reference { get; set; } = "";
    public string Note { get; set; } = "";
    public decimal Amount { get; set; }
    public decimal Fee { get; set; }
    public decimal Tax { get; set; }
    public decimal TaxRate { get; set; }
    public string TaxRule { get; set; } = "";
    public decimal Total { get; set; }
    public string Status { get; set; } = "";
    public string IdempotencyKey { get; set; } = "";
    public string RequestHash { get; set; } = "";
    public string ProviderReference { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? ReviewedBy { get; set; }
    public string? ReviewNote { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
}
public class LedgerEntry
{
    public long Id { get; set; }
    public Guid BatchId { get; set; }
    public Guid? PaymentId { get; set; }
    public string AccountCode { get; set; } = "";
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class AuditEvent
{
    public long Id { get; set; }
    public Guid? ActorId { get; set; }
    public string Action { get; set; } = "";
    public string Resource { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class CreditRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Purpose { get; set; } = "Consulta personal de historial crediticio";
    public string ConsentVersion { get; set; } = "equifax-personal-v1";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}


public class RoleDefinition
{
    public string Name { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string BaseRole { get; set; } = "Cliente";
    public bool System { get; set; }
    public long Version { get; set; }
}
public class PermissionDefinition
{
    public string Code { get; set; } = "";
    public string Description { get; set; } = "";
}
public class RolePermission
{
    public string RoleName { get; set; } = "";
    public string PermissionCode { get; set; } = "";
}
public class TopUp
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Kind { get; set; } = "RecargaSaldo";
    public decimal Amount { get; set; }
    public string Bank { get; set; } = "";
    public string Reference { get; set; } = "";
    public string DepositorName { get; set; } = "";
    public string SenderName { get; set; } = "";
    public string TransactionReference { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public string BeneficiaryName { get; set; } = "";
    public string ProtectedWithdrawalCode { get; set; } = "";
    public string ProtectedBeneficiaryCode { get; set; } = "";
    public string RequestFingerprint { get; set; } = "";
    public string Status { get; set; } = "Pendiente";
    public string IdempotencyKey { get; set; } = "";
    public string RequestHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
}
public class IntegrationSettings
{
    public string Id { get; set; } = "equifax";
    public string Mode { get; set; } = "Sandbox";
    public string Endpoint { get; set; } = "";
    public string ProtectedClientId { get; set; } = "";
    public string ProtectedApiKey { get; set; } = "";
    public string ProtectedClientSecret { get; set; } = "";
    public string RequestTemplate { get; set; } = "{\"document\":\"{{document}}\",\"documentType\":\"{{type}}\",\"requestId\":\"{{requestId}}\"}";
    public string ScorePath { get; set; } = "score";
    public string ApiKeyHeader { get; set; } = "X-API-Key";
    public string ClientIdHeader { get; set; } = "X-Client-Id";
    public string SecretHeader { get; set; } = "X-Client-Secret";
    public bool ContractVerified { get; set; }
    public bool Enabled { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class PlatformSettings
{
    public string Id { get; set; } = "platform";
    public byte[]? DeunaQrFile { get; set; }
    public string? DeunaQrMime { get; set; }
    public string? DeunaQrFileName { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? UpdatedBy { get; set; }
}
public class CreditReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string ProtectedDocument { get; set; } = "";
    public string DocumentMasked { get; set; } = "";
    public string DocumentHash { get; set; } = "";
    public string DocumentType { get; set; } = "";
    public string Mode { get; set; } = "Sandbox";
    public string Status { get; set; } = "Procesando";
    public decimal Cost { get; set; } = 5m;
    public string IdempotencyKey { get; set; } = "";
    public string ConsentVersion { get; set; } = "equifax-v2";
    public string? ReportJson { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
}
public class OutboxEvent
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public string EventType { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DispatchedAt { get; set; }
}
public static class Roles
{
    public const string Admin="Administrador", Executive="Ejecutivo", Client="Cliente";
    public static readonly string[] All=[Admin,Executive,Client];
}
public static class PermissionCatalog
{
    public static readonly string[] All=["transactions.read","transactions.create","transactions.settle","topups.read","topups.create","topups.approve","users.read","users.create","users.manage","roles.manage","audit.read","integrations.manage","credit.request","profile.edit"];
    public static readonly string[] Executive=["transactions.read","transactions.settle","topups.read","topups.approve","users.read","users.create","audit.read","profile.edit"];
    public static readonly string[] Client=["transactions.read","transactions.create","topups.read","topups.create","credit.request","profile.edit"];
    public static string[] For(string baseRole)=>baseRole switch { Roles.Admin=>All, Roles.Executive=>Executive, _=>Client };
}
public class BusinessException(string message,int status=400):Exception(message){public int Status {get;}=status;}
