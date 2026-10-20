using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DepoRet.Infrastructure.Migrations;

[DbContext(typeof(DepoDb))]
[Migration("20261020120000_RefreshOperatorSessions")]
public sealed class RefreshOperatorSessions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Role permissions are embedded in JWTs; bump the role version so operators receive new claims on next login.
        migrationBuilder.Sql("UPDATE \"Roles\" SET \"Version\"=\"Version\"+1 WHERE \"Name\"='Ejecutivo';");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE \"Roles\" SET \"Version\"=GREATEST(\"Version\"-1,0) WHERE \"Name\"='Ejecutivo';");
    }
}
