namespace Application.DTOs;

public class CorteProyectoUpdateDto
{
    public Guid? Id { get; set; }
    public DateTime FechaCorte { get; set; }
    public decimal ValorGanadoEV { get; set; }
    public decimal CostoRealAC { get; set; }
}
