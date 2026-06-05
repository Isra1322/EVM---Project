using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTareaEdtOrden : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Orden",
                table: "TareasEDT",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                WITH TareasOrdenadas AS (
                    SELECT
                        [Id],
                        ROW_NUMBER() OVER (PARTITION BY [ProyectoId] ORDER BY [Id]) AS [NumeroOrden]
                    FROM [TareasEDT]
                )
                UPDATE tarea
                SET [Orden] = orden.[NumeroOrden]
                FROM [TareasEDT] tarea
                INNER JOIN TareasOrdenadas orden ON tarea.[Id] = orden.[Id]
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Orden",
                table: "TareasEDT");
        }
    }
}
