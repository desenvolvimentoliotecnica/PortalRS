using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixMenuFuncaoCargoDisplay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // jobpositions.view -> Cargo (rota /Cadastro/Cargos), evita duas "Função" no menu
            migrationBuilder.Sql(@"
                UPDATE ""Menus""
                SET ""DisplayNameKey"" = 'Seed.Menu.Cargos', ""Route"" = '/Cadastro/Cargos', ""DisplayName"" = 'Cargo'
                WHERE ""PermissionKey"" = 'jobpositions.view';
            ");

            // categories.view -> Função (rota /Cadastro/Funcoes)
            migrationBuilder.Sql(@"
                UPDATE ""Menus""
                SET ""DisplayNameKey"" = 'Seed.Menu.Funcoes', ""Route"" = '/Cadastro/Funcoes', ""DisplayName"" = 'Função'
                WHERE ""PermissionKey"" = 'categories.view';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
