using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectCutoffDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CortesProyecto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProyectoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FechaCorte = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ValorGanadoEV = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CostoRealAC = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CortesProyecto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CortesProyecto_Proyectos_ProyectoId",
                        column: x => x.ProyectoId,
                        principalTable: "Proyectos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CortesProyecto_ProyectoId",
                table: "CortesProyecto",
                column: "ProyectoId");

            migrationBuilder.Sql("""
                INSERT INTO [CortesProyecto] ([Id], [ProyectoId], [FechaCorte], [ValorGanadoEV], [CostoRealAC])
                SELECT NEWID(), [Id], [FechaCorte], [ValorGanadoEV], [CostoRealAC]
                FROM [Proyectos]
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CortesProyecto");
        }
    }
}
