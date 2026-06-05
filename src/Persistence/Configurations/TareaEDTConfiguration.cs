using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Persistence.Configurations;

public class TareaEDTConfiguration : IEntityTypeConfiguration<TareaEDT>
{
    public void Configure(EntityTypeBuilder<TareaEDT> builder)
    {
        builder.HasKey(tarea => tarea.Id);

        builder.Property(tarea => tarea.Nombre)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(tarea => tarea.Orden)
            .IsRequired();

        builder.Property(tarea => tarea.Responsable)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(tarea => tarea.Predecesoras)
            .HasMaxLength(100);

        builder.Property(tarea => tarea.Costo)
            .HasColumnType("decimal(18,2)");
    }
}
