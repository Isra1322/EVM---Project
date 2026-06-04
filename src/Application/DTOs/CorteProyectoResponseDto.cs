namespace Application.DTOs;

public class CorteProyectoResponseDto
{
    public Guid Id { get; set; }
    public Guid ProyectoId { get; set; }
    public DateTime FechaCorte { get; set; }
    public decimal ValorGanadoEV { get; set; }
    public decimal CostoRealAC { get; set; }
}
