using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace DepoRet.Infrastructure;
public class DesignTimeFactory : IDesignTimeDbContextFactory<DepoDb>
{
    public DepoDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<DepoDb>()
        .UseNpgsql(Environment.GetEnvironmentVariable("ConnectionStrings__Database") ?? "Host=localhost;Database=depored;Username=depored").Options);
}

