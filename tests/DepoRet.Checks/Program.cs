using DepoRet.Domain;
using DepoRet.Application;
using DepoRet.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

var connection=Environment.GetEnvironmentVariable("CHECK_DATABASE")??throw new Exception("CHECK_DATABASE required; only isolated test databases.");
if(!new Npgsql.NpgsqlConnectionStringBuilder(connection).Database!.StartsWith("deporet_test_"))throw new Exception("Isolated test database required.");
var options=new DbContextOptionsBuilder<DepoDb>().UseNpgsql(connection).Options;
await using var db=new DepoDb(options);
var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Payments:Mode","Sandbox"},{"Fiscal:VatRate","0.15"},{"Fiscal:RuleVersion","QA"}}).Build();
var user=await db.Users.SingleAsync(u=>u.Email=="cliente@depored.test");var actor=new Actor(user.Id,Roles.Client,PermissionCatalog.Client);var access=new AccessService(db);var payments=new PaymentService(db,config,access);
var before=await db.Accounts.Where(a=>a.UserId==user.Id).Select(a=>a.Balance).SingleAsync();
var provider=new FailingProvider(async()=>{
    await using var concurrent=new DepoDb(options);await using var transaction=await concurrent.Database.BeginTransactionAsync();
    var account=await concurrent.Accounts.FromSqlInterpolated($"SELECT * FROM \"Accounts\" WHERE \"UserId\"={user.Id} FOR UPDATE").SingleAsync();
    Check(account.Balance==before-5m,"The charge must commit before contacting provider");
    account.Balance+=17m;Ledger.Post(concurrent,null,("qa:concurrent-deposit",17m,0m),($"customer:{user.Id}",0m,17m));await concurrent.SaveChangesAsync();await transaction.CommitAsync();
});
var service=new CreditService(db,payments,new TestVault(),provider);var key=Guid.NewGuid().ToString();
var report=await service.Request(actor,new("0000000000",true,"equifax-v2"),key,CancellationToken.None);
Check(report.Status=="Reembolsado","Provider failure must refund");
Check(await Balance()==before+17m,"Refund must preserve a concurrent deposit");
var replay=await service.Request(actor,new("0000000000",true,"equifax-v2"),key,CancellationToken.None);
Check(replay.Id==report.Id&&provider.Calls==1,"Replay must not recharge or recall provider");
Console.WriteLine("PASS provider failure: debit-first, concurrent balance preserved, refund once");
await using(var transaction=await db.Database.BeginTransactionAsync()){
    var account=await payments.Lock(user.Id);account.Balance-=5m;
    db.CreditReports.Add(new(){UserId=user.Id,ProtectedDocument="qa",DocumentMasked="******0000",DocumentHash="qa",DocumentType="CEDULA",Mode="Sandbox",IdempotencyKey=Guid.NewGuid().ToString(),CreatedAt=DateTimeOffset.UtcNow.AddMinutes(-10)});
    Ledger.Post(db,null,($"customer:{user.Id}",5m,0m),("credit:pending",0m,5m));await db.SaveChangesAsync();await transaction.CommitAsync();
}
await service.RecoverStale();await service.RecoverStale();Check(await Balance()==before+17m,"Recovery must refund interrupted request exactly once");
Console.WriteLine("PASS interrupted request recovery: refund exactly once");
async Task<decimal> Balance()=>await db.Accounts.AsNoTracking().Where(a=>a.UserId==user.Id).Select(a=>a.Balance).SingleAsync();
static void Check(bool condition,string message){if(!condition)throw new Exception(message);}
sealed class FailingProvider(Func<Task> onFetch):ICreditProvider{
    public int Calls {get;private set;}
    public async Task<string> Fetch(IntegrationSettings s,CreditReport r,string d,CancellationToken ct){Calls++;await onFetch();throw new HttpRequestException("Expected provider failure");}
    public Task ValidateEndpoint(string endpoint,CancellationToken ct)=>Task.CompletedTask;
    public Task<int> Probe(string endpoint,CancellationToken ct)=>Task.FromResult(200);
}
sealed class TestVault:ISecretVault{public string Protect(string value)=>Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(value));public string Unprotect(string value)=>System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(value));}
