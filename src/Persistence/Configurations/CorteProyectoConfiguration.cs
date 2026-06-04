using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class CorteProyectoConfiguration : IEntityTypeConfiguration<CorteProyecto>
{
    public void Configure(EntityTypeBuilder<CorteProyecto> builder)
    {
        builder.HasKey(corte => corte.Id);

        builder.Property(corte => corte.FechaCorte)
            .IsRequired();

        builder.Property(corte => corte.ValorGanadoEV)
            .HasColumnType("decimal(18,2)");

        builder.Property(corte => corte.CostoRealAC)
            .HasColumnType("decimal(18,2)");

        builder.HasOne(corte => corte.Proyecto)
            .WithMany(proyecto => proyecto.Cortes)
            .HasForeignKey(corte => corte.ProyectoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
