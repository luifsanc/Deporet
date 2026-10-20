using DepoRet.Application;
using DepoRet.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
namespace DepoRet.Infrastructure;
public static class Seed
{
    public static async Task Run(DepoDb db,IPasswordHasher<User> hasher,IConfiguration config)
    {
        foreach(var code in PermissionCatalog.All)if(!await db.Permissions.AnyAsync(p=>p.Code==code))db.Permissions.Add(new(){Code=code,Description=code});
        foreach(var name in Roles.All)if(!await db.Roles.AnyAsync(r=>r.Name==name))db.Roles.Add(new(){Name=name,DisplayName=name==Roles.Executive?"Operador":name,BaseRole=name,System=true});
        var operatorRole=await db.Roles.SingleOrDefaultAsync(r=>r.Name==Roles.Executive);if(operatorRole!=null)operatorRole.DisplayName="Operador";
        await db.SaveChangesAsync();
        if(!await db.Audit.AnyAsync(a=>a.Action=="v2.permissions.initialized")){
            foreach(var name in Roles.All)if(!await db.RolePermissions.AnyAsync(p=>p.RoleName==name))db.RolePermissions.AddRange(PermissionCatalog.For(name).Select(code=>new RolePermission{RoleName=name,PermissionCode=code}));
            db.Record(null,"v2.permissions.initialized","Initial role grants");
        }
        if(!await db.Integrations.AnyAsync())db.Integrations.Add(new(){Enabled=true});
        if(!await db.Platform.AnyAsync())db.Platform.Add(new());await db.SaveChangesAsync();
        if(await db.Users.AnyAsync()){
            // One-time migration of the original demonstration accounts, never business users.
            var executive=await db.Users.SingleOrDefaultAsync(u=>u.Email=="ejecutivo@depored.test");
            if(executive!=null&&!await db.Audit.AnyAsync(a=>a.Action=="v2.demo.assignment")){foreach(var u in await db.Users.Where(u=>u.Role==Roles.Client&&u.Email.EndsWith("@depored.test")).ToListAsync())u.AssignedExecutiveId=executive.Id;db.Record(null,"v2.demo.assignment","Migration of demo portfolio");await db.SaveChangesAsync();}
            return;
        }
        var demo=config.GetValue<bool>("Sandbox:Seed");if(demo&&config["Payments:Mode"]!="Sandbox")throw new InvalidOperationException("No se permite precargar datos de prueba en modo Manual.");
        var email=demo?"admin@depored.test":config["Bootstrap:Email"];
        var password=demo?config["Sandbox:Password"]:config["Bootstrap:Password"];
        if(string.IsNullOrWhiteSpace(email)||string.IsNullOrWhiteSpace(password)||password.Length<12)throw new InvalidOperationException("Configura las credenciales iniciales Bootstrap o Sandbox antes de iniciar una base vacía.");
        var admin=new User{Name="Administración DepoRet",Email=email.ToLowerInvariant(),Role=Roles.Admin,KycVerified=true};admin.PasswordHash=hasher.HashPassword(admin,password);db.Users.Add(admin);db.Accounts.Add(new(){UserId=admin.Id});
        if(demo){
            var executive=new User{Name="Valentina Torres",Email="ejecutivo@depored.test",Role=Roles.Executive,KycVerified=true};executive.PasswordHash=hasher.HashPassword(executive,password);db.Users.Add(executive);db.Accounts.Add(new(){UserId=executive.Id});
            var secondExec=new User{Name="Ejecutivo Norte",Email="ejecutivo2@depored.test",Role=Roles.Executive,KycVerified=true};secondExec.PasswordHash=hasher.HashPassword(secondExec,password);db.Users.Add(secondExec);db.Accounts.Add(new(){UserId=secondExec.Id});
            foreach(var name in new[]{"cliente","cliente2"}){var u=new User{Name=name=="cliente"?"Andrea Mendoza":"Carlos Andrade",Email=name+"@depored.test",Role=Roles.Client,KycVerified=true,AssignedExecutiveId=name=="cliente"?executive.Id:secondExec.Id};u.PasswordHash=hasher.HashPassword(u,password);db.Users.Add(u);db.Accounts.Add(new(){UserId=u.Id,Balance=12500});Ledger.Post(db,null,("sandbox:funding",12500m,0m),($"customer:{u.Id}",0m,12500m));}
        }
        db.Record(null,"system.initialized",demo?"Sandbox":"Bootstrap administrator");await db.SaveChangesAsync();
    }
}
