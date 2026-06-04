namespace Application.DTOs;

public class CorteCurvaSDto
{
    public Guid CorteId { get; set; }
    public DateTime FechaCorte { get; set; }
    public decimal EV { get; set; }
    public decimal AC { get; set; }
}
