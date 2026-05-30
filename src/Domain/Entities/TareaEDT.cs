namespace Domain.Entities;

public class TareaEDT
{
    public Guid Id { get; set; }
    public Guid ProyectoId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int DuracionDias { get; set; }
    public string? Predecesoras { get; set; }
    public decimal Costo { get; set; }
    public string Responsable { get; set; } = string.Empty;
    public Proyecto Proyecto { get; set; } = null!;
}
