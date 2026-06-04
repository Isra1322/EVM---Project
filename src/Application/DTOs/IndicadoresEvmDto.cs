namespace Application.DTOs;

public class IndicadoresEvmDto
{
    public Guid ProyectoId { get; set; }
    public Guid? CorteId { get; set; }
    public string NombreProyecto { get; set; } = string.Empty;
    public DateTime? FechaCorte { get; set; }
    public decimal PV { get; set; }
    public decimal EV { get; set; }
    public decimal AC { get; set; }
    public decimal BAC { get; set; }
    public decimal SV { get; set; }
    public decimal CV { get; set; }
    public decimal SPI { get; set; }
    public decimal CPI { get; set; }
    public decimal EAC { get; set; }
    public decimal ETC { get; set; }
    public decimal VAC { get; set; }
    public decimal TCPI { get; set; }
}
