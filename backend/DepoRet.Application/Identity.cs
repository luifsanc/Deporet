using DepoRet.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace DepoRet.Application;

public record LoginResult(User User,RoleDefinition Role,string[] Permissions);
public class IdentityService(IAppDb db,IPasswordHasher<User> hasher)
{
    private static readonly User Dummy=new();
    private static readonly string DummyHash=new PasswordHasher<User>().HashPassword(Dummy,"Timing-only-not-a-login-password");
    public async Task<LoginResult> Login(LoginRequest request)
    {
        Validation.Check(request);var email=request.Email.Trim().ToLowerInvariant();
        await using var tx=await db.Database.BeginTransactionAsync();
        var user=await db.Users.FromSqlInterpolated($"SELECT * FROM \"users\" WHERE \"Email\"={email} FOR UPDATE").SingleOrDefaultAsync();
        var verified=hasher.VerifyHashedPassword(user??Dummy,user?.PasswordHash??DummyHash,request.Password);
        if(user==null||!user.Active||user.LockedUntil>DateTimeOffset.UtcNow||verified==PasswordVerificationResult.Failed){
            if(user!=null){user.FailedLogins++;if(user.FailedLogins>=5){user.LockedUntil=DateTimeOffset.UtcNow.AddMinutes(15);user.FailedLogins=0;}db.Record(user.Id,"auth.failed",user.Id.ToString());await db.SaveChangesAsync();await tx.CommitAsync();}
            throw new BusinessException("Correo o contraseña incorrectos, o acceso temporalmente bloqueado.",401);
        }
        user.FailedLogins=0;user.LockedUntil=null;
        if(verified==PasswordVerificationResult.SuccessRehashNeeded)user.PasswordHash=hasher.HashPassword(user,request.Password);
        var role=await db.Roles.SingleAsync(r=>r.Name==user.Role);var permissions=await db.RolePermissions.Where(p=>p.RoleName==role.Name).Select(p=>p.PermissionCode).ToArrayAsync();
        db.Record(user.Id,"auth.login",user.Id.ToString());await db.SaveChangesAsync();await tx.CommitAsync();return new(user,role,permissions);
    }
    public async Task<User> Create(Actor actor,UserCreate r)
    {
        actor.Demand("users.create");Validation.Check(r);
        if(actor.Executive&&r.Role!=Roles.Client)throw new BusinessException("El ejecutivo solo puede registrar clientes.",403);
        if(!actor.Admin&&!actor.Executive)throw new BusinessException("No autorizado.",403);
        var role=await db.Roles.SingleOrDefaultAsync(x=>x.Name==r.Role)??throw new BusinessException("Rol no encontrado.");
        var assigned=actor.Executive?actor.Id:r.AssignedExecutiveId;await ValidateExecutive(assigned);
        var email=r.Email.Trim().ToLowerInvariant();if(await db.Users.AnyAsync(u=>u.Email==email))throw new BusinessException("El correo ya está registrado.",409);
        var user=new User{Name=r.Name.Trim(),Email=email,Role=role.Name,AssignedExecutiveId=role.BaseRole==Roles.Client?assigned:null};user.PasswordHash=hasher.HashPassword(user,r.Password);
        db.Users.Add(user);db.Accounts.Add(new(){UserId=user.Id});db.Record(actor.Id,"user.created",user.Id.ToString());await db.SaveChangesAsync();return user;
    }
    public async Task<User> Change(Actor actor,Guid id,UserChange r)
    {
        actor.Demand("users.manage");if(!actor.Admin)throw new BusinessException("Solo el administrador gestiona accesos.",403);Validation.Check(r);
        if(actor.Id==id)throw new BusinessException("No puedes cambiar tu propio acceso.",409);
        await using var tx=await db.Database.BeginTransactionAsync();await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(871238)");
        var user=await db.Users.SingleOrDefaultAsync(u=>u.Id==id)??throw new BusinessException("Usuario no encontrado.",404);
        var role=await db.Roles.SingleOrDefaultAsync(x=>x.Name==r.Role)??throw new BusinessException("Rol no encontrado.");
        var old=await db.Roles.SingleAsync(x=>x.Name==user.Role);
        if(old.BaseRole==Roles.Admin&&(!r.Active||role.BaseRole!=Roles.Admin)&&await (from u in db.Users join ro in db.Roles on u.Role equals ro.Name where u.Active&&ro.BaseRole==Roles.Admin select u.Id).CountAsync()<=1)throw new BusinessException("Debe permanecer un administrador activo.",409);
        await ValidateExecutive(r.AssignedExecutiveId);if(r.AssignedExecutiveId==id)throw new BusinessException("Un usuario no puede asignarse a sí mismo.");
        user.Role=r.Role;user.Active=r.Active;user.KycVerified=r.KycVerified;user.AssignedExecutiveId=role.BaseRole==Roles.Client?r.AssignedExecutiveId:null;user.SecurityVersion++;
        db.Record(actor.Id,$"user.access:{r.Role}:{r.Active}:kyc={r.KycVerified}",id.ToString());db.Notify(id,"access.changed");await db.SaveChangesAsync();await tx.CommitAsync();return user;
    }
    private async Task ValidateExecutive(Guid? id){if(id.HasValue&&!await (from u in db.Users join r in db.Roles on u.Role equals r.Name where u.Id==id&&u.Active&&r.BaseRole==Roles.Executive select u.Id).AnyAsync())throw new BusinessException("El ejecutivo asignado no está habilitado.");}
    public async Task<RoleDefinition> SaveRole(Actor actor,RoleChange r)
    {
        actor.Demand("roles.manage");if(!actor.Admin)throw new BusinessException("No autorizado.",403);Validation.Check(r);
        if(!Roles.All.Contains(r.BaseRole)||r.Permissions.Any(p=>!PermissionCatalog.For(r.BaseRole).Contains(p)))throw new BusinessException("Hay permisos incompatibles con el perfil base.");
        if(r.Name==Roles.Admin&&!PermissionCatalog.All.All(r.Permissions.Contains))throw new BusinessException("El administrador principal debe conservar el control total.");
        await using var tx=await db.Database.BeginTransactionAsync();await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(871238)");
        var role=await db.Roles.SingleOrDefaultAsync(x=>x.Name==r.Name);
        if(role!=null&&role.BaseRole!=r.BaseRole)throw new BusinessException("El perfil base de un rol existente no se puede cambiar.",409);
        if(role==null){role=new(){Name=r.Name,BaseRole=r.BaseRole};db.Roles.Add(role);}role.DisplayName=r.DisplayName.Trim();role.Version++;
        db.RolePermissions.RemoveRange(await db.RolePermissions.Where(p=>p.RoleName==r.Name).ToListAsync());await db.SaveChangesAsync();
        db.RolePermissions.AddRange(r.Permissions.Distinct().Select(p=>new RolePermission{RoleName=r.Name,PermissionCode=p}));
        db.Record(actor.Id,"role.permissions.updated",r.Name);await db.SaveChangesAsync();await tx.CommitAsync();return role;
    }
    public async Task<User> Profile(Actor a,ProfileChange r){a.Demand("profile.edit");Validation.Check(r);var user=await db.Users.SingleAsync(u=>u.Id==a.Id);user.Name=r.Name.Trim();user.Phone=r.Phone;db.Record(a.Id,"profile.updated",a.Id.ToString());await db.SaveChangesAsync();return user;}
    public async Task Password(Actor a,PasswordChange r){a.Demand("profile.edit");Validation.Check(r);await using var tx=await db.Database.BeginTransactionAsync();var user=await db.Users.FromSqlInterpolated($"SELECT * FROM \"users\" WHERE \"Id\"={a.Id} FOR UPDATE").SingleAsync();
        if(hasher.VerifyHashedPassword(user,user.PasswordHash,r.CurrentPassword)==PasswordVerificationResult.Failed)throw new BusinessException("La contraseña actual no es correcta.");
        if(r.NewPassword==r.CurrentPassword)throw new BusinessException("Elige una contraseña diferente.");user.PasswordHash=hasher.HashPassword(user,r.NewPassword);user.SecurityVersion++;db.Record(a.Id,"profile.password.changed",a.Id.ToString());db.Notify(a.Id,"access.changed");await db.SaveChangesAsync();await tx.CommitAsync();}
}
