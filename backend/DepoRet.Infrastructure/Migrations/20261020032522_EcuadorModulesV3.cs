using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DepoRet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EcuadorModulesV3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Accounts_Users_UserId",
                table: "Accounts");

            migrationBuilder.DropForeignKey(
                name: "FK_CreditReports_Users_UserId",
                table: "CreditReports");

            migrationBuilder.DropForeignKey(
                name: "FK_Ledger_Payments_PaymentId",
                table: "Ledger");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Users_UserId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_TopUps_Users_UserId",
                table: "TopUps");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Roles_Role",
                table: "Users");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Users_AssignedExecutiveId",
                table: "Users");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Users",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_TopUps_Bank_Reference",
                table: "TopUps");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Payments",
                table: "Payments");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Integrations",
                table: "Integrations");

            migrationBuilder.RenameTable(
                name: "Users",
                newName: "users");

            migrationBuilder.RenameTable(
                name: "Payments",
                newName: "transactions");

            migrationBuilder.RenameTable(
                name: "Integrations",
                newName: "equifax_config");

            migrationBuilder.RenameIndex(
                name: "IX_Users_Role",
                table: "users",
                newName: "IX_users_Role");

            migrationBuilder.RenameIndex(
                name: "IX_Users_Email",
                table: "users",
                newName: "IX_users_Email");

            migrationBuilder.RenameIndex(
                name: "IX_Users_AssignedExecutiveId",
                table: "users",
                newName: "IX_users_AssignedExecutiveId");

            migrationBuilder.RenameIndex(
                name: "IX_Payments_UserId_IdempotencyKey",
                table: "transactions",
                newName: "IX_transactions_UserId_IdempotencyKey");

            migrationBuilder.RenameIndex(
                name: "IX_Payments_CreatedAt",
                table: "transactions",
                newName: "IX_transactions_CreatedAt");

            migrationBuilder.AddColumn<string>(
                name: "BeneficiaryName",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DepositorName",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProtectedBeneficiaryCode",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProtectedWithdrawalCode",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RequestFingerprint",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SenderName",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TransactionReference",
                table: "TopUps",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AccountNumber",
                table: "transactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AccountType",
                table: "transactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "transactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BeneficiaryName",
                table: "transactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DeliveryMethod",
                table: "transactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DocumentNumber",
                table: "transactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DocumentType",
                table: "transactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClientIdHeader",
                table: "equifax_config",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "Enabled",
                table: "equifax_config",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ProtectedClientId",
                table: "equifax_config",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("UPDATE \"TopUps\" SET \"Kind\" = 'RecargaSaldo' WHERE \"Kind\" = '';");
            migrationBuilder.Sql("UPDATE \"equifax_config\" SET \"Enabled\" = TRUE WHERE \"Mode\" = 'Sandbox';");
            migrationBuilder.Sql("UPDATE \"equifax_config\" SET \"ClientIdHeader\" = 'X-Client-Id' WHERE \"ClientIdHeader\" = '';");
            migrationBuilder.Sql("UPDATE \"Accounts\" AS a SET \"Reserved\" = GREATEST(0, a.\"Reserved\" - x.\"Total\") FROM (SELECT \"UserId\", SUM(\"Total\") AS \"Total\" FROM \"transactions\" WHERE \"Kind\" = 'servicio' AND \"Status\" = 'Procesando' GROUP BY \"UserId\") AS x WHERE a.\"UserId\" = x.\"UserId\";");
            migrationBuilder.Sql("UPDATE \"transactions\" SET \"Status\" = 'Rechazada', \"ReviewNote\" = 'Módulo retirado del alcance de la plataforma.' WHERE \"Kind\" = 'servicio' AND \"Status\" = 'Procesando';");

            migrationBuilder.AddPrimaryKey(
                name: "PK_users",
                table: "users",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_transactions",
                table: "transactions",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_equifax_config",
                table: "equifax_config",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "platform_settings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    DeunaQrFile = table.Column<byte[]>(type: "bytea", nullable: true),
                    DeunaQrMime = table.Column<string>(type: "text", nullable: true),
                    DeunaQrFileName = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_settings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TopUps_Bank_Reference",
                table: "TopUps",
                columns: new[] { "Bank", "Reference" },
                unique: true,
                filter: "\"Reference\" <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_TopUps_RequestFingerprint",
                table: "TopUps",
                column: "RequestFingerprint",
                unique: true,
                filter: "\"RequestFingerprint\" <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_TopUps_TransactionReference",
                table: "TopUps",
                column: "TransactionReference",
                unique: true,
                filter: "\"TransactionReference\" <> ''");

            migrationBuilder.AddForeignKey(
                name: "FK_Accounts_users_UserId",
                table: "Accounts",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CreditReports_users_UserId",
                table: "CreditReports",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Ledger_transactions_PaymentId",
                table: "Ledger",
                column: "PaymentId",
                principalTable: "transactions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TopUps_users_UserId",
                table: "TopUps",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_transactions_users_UserId",
                table: "transactions",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_users_Roles_Role",
                table: "users",
                column: "Role",
                principalTable: "Roles",
                principalColumn: "Name",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_users_users_AssignedExecutiveId",
                table: "users",
                column: "AssignedExecutiveId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Accounts_users_UserId",
                table: "Accounts");

            migrationBuilder.DropForeignKey(
                name: "FK_CreditReports_users_UserId",
                table: "CreditReports");

            migrationBuilder.DropForeignKey(
                name: "FK_Ledger_transactions_PaymentId",
                table: "Ledger");

            migrationBuilder.DropForeignKey(
                name: "FK_TopUps_users_UserId",
                table: "TopUps");

            migrationBuilder.DropForeignKey(
                name: "FK_transactions_users_UserId",
                table: "transactions");

            migrationBuilder.DropForeignKey(
                name: "FK_users_Roles_Role",
                table: "users");

            migrationBuilder.DropForeignKey(
                name: "FK_users_users_AssignedExecutiveId",
                table: "users");

            migrationBuilder.DropTable(
                name: "platform_settings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_users",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_TopUps_Bank_Reference",
                table: "TopUps");

            migrationBuilder.DropIndex(
                name: "IX_TopUps_RequestFingerprint",
                table: "TopUps");

            migrationBuilder.DropIndex(
                name: "IX_TopUps_TransactionReference",
                table: "TopUps");

            migrationBuilder.DropPrimaryKey(
                name: "PK_transactions",
                table: "transactions");

            migrationBuilder.DropPrimaryKey(
                name: "PK_equifax_config",
                table: "equifax_config");

            migrationBuilder.DropColumn(
                name: "BeneficiaryName",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "DepositorName",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "ProtectedBeneficiaryCode",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "ProtectedWithdrawalCode",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "RequestFingerprint",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "SenderName",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "TransactionReference",
                table: "TopUps");

            migrationBuilder.DropColumn(
                name: "AccountNumber",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "AccountType",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "BeneficiaryName",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "DeliveryMethod",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "DocumentNumber",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "DocumentType",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "ClientIdHeader",
                table: "equifax_config");

            migrationBuilder.DropColumn(
                name: "Enabled",
                table: "equifax_config");

            migrationBuilder.DropColumn(
                name: "ProtectedClientId",
                table: "equifax_config");

            migrationBuilder.RenameTable(
                name: "users",
                newName: "Users");

            migrationBuilder.RenameTable(
                name: "transactions",
                newName: "Payments");

            migrationBuilder.RenameTable(
                name: "equifax_config",
                newName: "Integrations");

            migrationBuilder.RenameIndex(
                name: "IX_users_Role",
                table: "Users",
                newName: "IX_Users_Role");

            migrationBuilder.RenameIndex(
                name: "IX_users_Email",
                table: "Users",
                newName: "IX_Users_Email");

            migrationBuilder.RenameIndex(
                name: "IX_users_AssignedExecutiveId",
                table: "Users",
                newName: "IX_Users_AssignedExecutiveId");

            migrationBuilder.RenameIndex(
                name: "IX_transactions_UserId_IdempotencyKey",
                table: "Payments",
                newName: "IX_Payments_UserId_IdempotencyKey");

            migrationBuilder.RenameIndex(
                name: "IX_transactions_CreatedAt",
                table: "Payments",
                newName: "IX_Payments_CreatedAt");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Users",
                table: "Users",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Payments",
                table: "Payments",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Integrations",
                table: "Integrations",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_TopUps_Bank_Reference",
                table: "TopUps",
                columns: new[] { "Bank", "Reference" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Accounts_Users_UserId",
                table: "Accounts",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CreditReports_Users_UserId",
                table: "CreditReports",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Ledger_Payments_PaymentId",
                table: "Ledger",
                column: "PaymentId",
                principalTable: "Payments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Users_UserId",
                table: "Payments",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TopUps_Users_UserId",
                table: "TopUps",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Roles_Role",
                table: "Users",
                column: "Role",
                principalTable: "Roles",
                principalColumn: "Name",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Users_AssignedExecutiveId",
                table: "Users",
                column: "AssignedExecutiveId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
