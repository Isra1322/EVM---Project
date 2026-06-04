using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class ProyectoConfiguration : IEntityTypeConfiguration<Proyecto>
{
    public void Configure(EntityTypeBuilder<Proyecto> builder)
    {
        builder.HasKey(proyecto => proyecto.Id);

        builder.Property(proyecto => proyecto.Nombre)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(proyecto => proyecto.UnidadTiempo)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(proyecto => proyecto.AdministradorProyecto)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(proyecto => proyecto.AsistenteProyecto)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(proyecto => proyecto.ValorGanadoEV)
            .HasColumnType("decimal(18,2)");

        builder.Property(proyecto => proyecto.CostoRealAC)
            .HasColumnType("decimal(18,2)");

        builder.Property(proyecto => proyecto.PresupuestoBAC)
            .HasColumnType("decimal(18,2)");

        builder.HasMany(proyecto => proyecto.Tareas)
            .WithOne(tarea => tarea.Proyecto)
            .HasForeignKey(tarea => tarea.ProyectoId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(proyecto => proyecto.Cortes)
            .WithOne(corte => corte.Proyecto)
            .HasForeignKey(corte => corte.ProyectoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
