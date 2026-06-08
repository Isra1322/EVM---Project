namespace Application.DTOs;

public class EvolucionIndicadoresDto
{
    public Guid CorteId { get; set; }
    public DateTime FechaCorte { get; set; }
    public decimal SPI { get; set; }
    public decimal CPI { get; set; }
    public decimal PV { get; set; }
    public decimal EV { get; set; }
    public decimal AC { get; set; }
}
