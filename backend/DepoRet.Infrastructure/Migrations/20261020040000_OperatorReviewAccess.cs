using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DepoRet.Infrastructure.Migrations;

[DbContext(typeof(DepoDb))]
[Migration("20261020040000_OperatorReviewAccess")]
public sealed class OperatorReviewAccess : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE \"Roles\" SET \"DisplayName\"='Operador' WHERE \"Name\"='Ejecutivo';");
        migrationBuilder.Sql("UPDATE \"equifax_config\" SET \"Mode\"='Sandbox' WHERE \"Mode\"='Staging';");
        migrationBuilder.Sql("""
            INSERT INTO "Permissions" ("Code", "Description")
            VALUES ('transactions.read', 'Consultar transacciones'),
                   ('transactions.settle', 'Revisar transacciones pendientes'),
                   ('topups.read', 'Ver solicitudes de acreditación'),
                   ('topups.approve', 'Aprobar o rechazar solicitudes de acreditación'),
                   ('users.read', 'Consultar usuarios de la cartera'),
                   ('users.create', 'Registrar clientes'),
                   ('audit.read', 'Consultar auditoría'),
                   ('profile.edit', 'Editar perfil')
            ON CONFLICT ("Code") DO NOTHING;
            """);
        migrationBuilder.Sql("""
            INSERT INTO "RolePermissions" ("RoleName", "PermissionCode")
            SELECT 'Ejecutivo', p."PermissionCode"
            FROM (VALUES ('transactions.read'), ('transactions.settle'), ('topups.read'), ('topups.approve'), ('users.read'), ('users.create'), ('audit.read'), ('profile.edit')) AS p("PermissionCode")
            WHERE NOT EXISTS (
                SELECT 1 FROM "RolePermissions" rp
                WHERE rp."RoleName"='Ejecutivo' AND rp."PermissionCode"=p."PermissionCode"
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DELETE FROM \"RolePermissions\" WHERE \"RoleName\"='Ejecutivo' AND \"PermissionCode\" IN ('transactions.read','transactions.settle','topups.read','topups.approve','users.read','users.create','audit.read','profile.edit');");
        migrationBuilder.Sql("UPDATE \"Roles\" SET \"DisplayName\"='Ejecutivo' WHERE \"Name\"='Ejecutivo';");
    }
}
