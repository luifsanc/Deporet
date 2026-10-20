using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DepoRet.Application;
using DepoRet.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
namespace DepoRet.Api.Controllers;
[Route("api/auth")]
public class AuthController(IdentityService identity,IConfiguration config):AppController
{
    [HttpPost("login"),AllowAnonymous,EnableRateLimiting("login")]
    public async Task<object> Login(LoginRequest request){var result=await identity.Login(request);var u=result.User;var r=result.Role;var claims=new List<Claim>{new(ClaimTypes.NameIdentifier,u.Id.ToString()),new(ClaimTypes.Name,u.Name),new(ClaimTypes.Role,u.Role),new("baseRole",r.BaseRole),new("ver",u.SecurityVersion.ToString()),new("rver",r.Version.ToString())};claims.AddRange(result.Permissions.Select(p=>new Claim("permission",p)));
        var expires=DateTime.UtcNow.AddMinutes(20);var token=new JwtSecurityToken("deporet","deporet-web",claims,expires:expires,signingCredentials:new(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Auth:SigningKey"]!)),SecurityAlgorithms.HmacSha256));
        return new{token=new JwtSecurityTokenHandler().WriteToken(token),expiresAt=expires,user=Views.User(u,r.BaseRole,result.Permissions)};
    }
}
[Route("api")]
public class ProfileController(IAppDb db,IdentityService identity,IAvatarValidator images):AppController
{
    [HttpGet("me")]public async Task<object> Me(){var a=Current;return Views.User(await db.Users.SingleAsync(u=>u.Id==a.Id),a.BaseRole,a.Permissions);}
    [HttpPatch("profile"),Authorize(Policy="profile.edit")]public async Task<object> Update(ProfileChange r)=>Views.User(await identity.Profile(Current,r),Current.BaseRole,Current.Permissions);
    [HttpPost("profile/password"),Authorize(Policy="profile.edit"),EnableRateLimiting("sensitive")]public async Task<object> Password(PasswordChange r){await identity.Password(Current,r);return new{message="Contraseña actualizada. Todas las sesiones se cerraron."};}
    [HttpPost("profile/avatar"),Authorize(Policy="profile.edit"),EnableRateLimiting("sensitive"),RequestSizeLimit(2162688)]
    public async Task<object> Avatar([FromForm]IFormFile file,CancellationToken ct){if(file.Length<=0||file.Length>2*1024*1024)throw new BusinessException("La imagen debe pesar como máximo 2 MB.");using var buffer=new MemoryStream();await file.CopyToAsync(buffer,ct);var validated=await images.Validate(buffer.ToArray(),file.ContentType,file.FileName,ct);var a=Current;var user=await db.Users.SingleAsync(u=>u.Id==a.Id,ct);user.Avatar=validated.Data;user.AvatarMime=validated.Mime;db.Record(a.Id,"profile.avatar.updated",a.Id.ToString());await db.SaveChangesAsync(ct);return new{message="Foto actualizada."};}
    [HttpGet("profile/avatar")]public async Task<IActionResult> Avatar(){var id=Current.Id;var u=await db.Users.AsNoTracking().SingleAsync(u=>u.Id==id);return u.Avatar==null?NotFound():File(u.Avatar,u.AvatarMime!);}
}
[Route("api")]
public class UsersController(IAppDb db,IdentityService identity,AccessService access):AppController
{
    [HttpGet("users"),Authorize(Policy="users.read")]
    public async Task<object> List(){var users=await access.Users(Current).AsNoTracking().OrderBy(u=>u.Name).Take(500).ToListAsync();var roles=await db.Roles.ToDictionaryAsync(r=>r.Name,r=>r.BaseRole);return users.Select(u=>Views.User(u,roles[u.Role],[]));}
    [HttpPost("users"),Authorize(Policy="users.create"),EnableRateLimiting("sensitive")]
    public async Task<object> Create(UserCreate r){var u=await identity.Create(Current,r);var role=await db.Roles.SingleAsync(x=>x.Name==u.Role);return Views.User(u,role.BaseRole,[]);}
    [HttpPatch("users/{id:guid}"),Authorize(Policy="users.manage")]
    public async Task<object> Update(Guid id,UserChange r){var u=await identity.Change(Current,id,r);var role=await db.Roles.SingleAsync(x=>x.Name==u.Role);return Views.User(u,role.BaseRole,[]);}
    [HttpGet("roles"),Authorize(Policy="roles.manage")]
    public async Task<object> Roles(){var roles=await db.Roles.AsNoTracking().OrderBy(r=>r.Name).ToListAsync();var permissions=await db.RolePermissions.AsNoTracking().ToListAsync();return new{roles=roles.Select(r=>new{r.Name,r.DisplayName,r.BaseRole,r.System,permissions=permissions.Where(p=>p.RoleName==r.Name).Select(p=>p.PermissionCode)}),permissions=await db.Permissions.AsNoTracking().ToListAsync(),allowedByBase=new Dictionary<string,string[]>{{Domain.Roles.Admin,PermissionCatalog.All},{Domain.Roles.Executive,PermissionCatalog.Executive},{Domain.Roles.Client,PermissionCatalog.Client}}};}
    [HttpPut("roles"),Authorize(Policy="roles.manage")]
    public async Task<object> Role(RoleChange r)=>await identity.SaveRole(Current,r);
    [HttpGet("audit"),Authorize(Policy="audit.read")]
    public async Task<object> Audit()=>await db.Audit.AsNoTracking().OrderByDescending(a=>a.Id).Take(100).ToListAsync();
}
