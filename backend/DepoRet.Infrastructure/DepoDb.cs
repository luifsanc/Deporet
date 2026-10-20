using DepoRet.Domain;
using DepoRet.Application;
using Microsoft.EntityFrameworkCore;
namespace DepoRet.Infrastructure;
public class DepoDb(DbContextOptions<DepoDb> options) : DbContext(options), IAppDb
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<LedgerEntry> Ledger => Set<LedgerEntry>();
    public DbSet<AuditEvent> Audit => Set<AuditEvent>();
    public DbSet<CreditRequest> CreditRequests => Set<CreditRequest>();
    public DbSet<RoleDefinition> Roles => Set<RoleDefinition>();
    public DbSet<PermissionDefinition> Permissions => Set<PermissionDefinition>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<TopUp> TopUps => Set<TopUp>();
    public DbSet<IntegrationSettings> Integrations => Set<IntegrationSettings>();
    public DbSet<PlatformSettings> Platform => Set<PlatformSettings>();
    public DbSet<CreditReport> CreditReports => Set<CreditReport>();
    public DbSet<OutboxEvent> Outbox => Set<OutboxEvent>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<RoleDefinition>().HasKey(x=>x.Name);
        b.Entity<RoleDefinition>().Property(x=>x.Name).HasMaxLength(50);
        b.Entity<PermissionDefinition>().HasKey(x=>x.Code);
        b.Entity<RolePermission>().HasKey(x=>new{x.RoleName,x.PermissionCode});
        b.Entity<RolePermission>().HasOne<RoleDefinition>().WithMany().HasForeignKey(x=>x.RoleName);
        b.Entity<RolePermission>().HasOne<PermissionDefinition>().WithMany().HasForeignKey(x=>x.PermissionCode);
        b.Entity<User>().HasOne<RoleDefinition>().WithMany().HasForeignKey(x=>x.Role).OnDelete(DeleteBehavior.Restrict);
        b.Entity<User>().HasOne<User>().WithMany().HasForeignKey(x=>x.AssignedExecutiveId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<User>().ToTable("users");
        b.Entity<Account>().ToTable(t=>t.HasCheckConstraint("CK_Account_Reserved", "\"Reserved\" >= 0 AND \"Reserved\" <= \"Balance\""));
        b.Entity<TopUp>().HasIndex(x=>new{x.UserId,x.IdempotencyKey}).IsUnique();
        b.Entity<TopUp>().HasIndex(x=>new{x.Bank,x.Reference}).IsUnique().HasFilter("\"Reference\" <> ''");
        b.Entity<TopUp>().HasIndex(x=>x.TransactionReference).IsUnique().HasFilter("\"TransactionReference\" <> ''");
        b.Entity<TopUp>().HasIndex(x=>x.RequestFingerprint).IsUnique().HasFilter("\"RequestFingerprint\" <> ''");
        b.Entity<TopUp>().HasOne<User>().WithMany().HasForeignKey(x=>x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TopUp>().ToTable(t=>t.HasCheckConstraint("CK_TopUp_Amount", "\"Amount\" > 0"));
        b.Entity<CreditReport>().HasIndex(x=>new{x.UserId,x.IdempotencyKey}).IsUnique();
        b.Entity<PlatformSettings>().HasKey(x=>x.Id);
        b.Entity<PlatformSettings>().Property(x=>x.DeunaQrFile).HasColumnType("bytea");
        b.Entity<PlatformSettings>().ToTable("platform_settings");
        b.Entity<IntegrationSettings>().ToTable("equifax_config");
        b.Entity<CreditReport>().HasOne<User>().WithMany().HasForeignKey(x=>x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<OutboxEvent>().HasIndex(x=>x.DispatchedAt);
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<User>().Property(x => x.Email).HasMaxLength(254);
        b.Entity<Account>().HasIndex(x => x.UserId).IsUnique();
        b.Entity<Account>().HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        b.Entity<Account>().ToTable(t => t.HasCheckConstraint("CK_Account_Balance", "\"Balance\" >= 0"));
        b.Entity<Payment>().HasIndex(x => new { x.UserId, x.IdempotencyKey }).IsUnique();
        b.Entity<Payment>().HasIndex(x => x.CreatedAt);
        b.Entity<Payment>().HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        b.Entity<Payment>().ToTable("transactions",t => t.HasCheckConstraint("CK_Payment_Amounts", "\"Amount\" > 0 AND \"Fee\" >= 0 AND \"Tax\" >= 0 AND \"Total\" = \"Amount\" + \"Fee\" + \"Tax\""));
        b.Entity<LedgerEntry>().HasOne<Payment>().WithMany().HasForeignKey(x => x.PaymentId);
        b.Entity<LedgerEntry>().ToTable(t => t.HasCheckConstraint("CK_Ledger_Side", "\"Debit\" >= 0 AND \"Credit\" >= 0 AND NOT (\"Debit\" > 0 AND \"Credit\" > 0)"));
        foreach (var entity in b.Model.GetEntityTypes())
            foreach (var p in entity.GetProperties().Where(p => p.ClrType == typeof(decimal))) { p.SetPrecision(18); p.SetScale(p.Name == "TaxRate" ? 4 : 2); }
    }
    public void Record(Guid? actor, string action, string resource) => Audit.Add(new() { ActorId = actor, Action = action, Resource = resource });
    public void Notify(Guid user,string eventType)=>Outbox.Add(new(){UserId=user,EventType=eventType});
}

