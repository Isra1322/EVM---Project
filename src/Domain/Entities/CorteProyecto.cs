namespace Domain.Entities;

public class CorteProyecto
{
    public Guid Id { get; set; }
    public Guid ProyectoId { get; set; }
    public DateTime FechaCorte { get; set; }
    public decimal ValorGanadoEV { get; set; }
    public decimal CostoRealAC { get; set; }
    public Proyecto Proyecto { get; set; } = null!;
}
