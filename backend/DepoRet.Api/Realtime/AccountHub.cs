using DepoRet.Application;
using DepoRet.Domain;
using DepoRet.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
namespace DepoRet.Api.Realtime;
[Authorize]
public class AccountHub:Hub { }
public class OutboxDispatcher(IServiceScopeFactory scopes,IHubContext<AccountHub> hub,ILogger<OutboxDispatcher> logger):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(2));
        while(await timer.WaitForNextTickAsync(stoppingToken)){
            try{await using var scope=scopes.CreateAsyncScope();var db=scope.ServiceProvider.GetRequiredService<DepoDb>();
                await scope.ServiceProvider.GetRequiredService<CreditService>().RecoverStale();
                var events=await db.Outbox.Where(e=>e.DispatchedAt==null).OrderBy(e=>e.Id).Take(100).ToListAsync(stoppingToken);
                foreach(var e in events){
                    var reviewers=await (from u in db.Users join rp in db.RolePermissions on u.Role equals rp.RoleName where u.Active&&(rp.PermissionCode=="transactions.settle"||rp.PermissionCode=="topups.approve") select u.Id).Distinct().ToListAsync(stoppingToken);
                    var recipients=reviewers.Append(e.UserId).ToList();
                    // Invalidation only, never balances, documents or report data on a long-lived socket.
                    await hub.Clients.Users(recipients.Distinct().Select(x=>x.ToString()).ToArray()).SendAsync("changed",new{eventId=e.Id,type=e.EventType},stoppingToken);e.DispatchedAt=DateTimeOffset.UtcNow;
                }
                await db.SaveChangesAsync(stoppingToken);
            }catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested){break;}catch(Exception ex){logger.LogWarning("La cola de notificaciones reintentará: {ErrorType}",ex.GetType().Name);}
        }
    }
}
