namespace Application.DTOs;

public class AnalisisIaDto
{
    public Guid ProyectoId { get; set; }
    public string NombreProyecto { get; set; } = string.Empty;
    public string AnalisisGenerado { get; set; } = string.Empty;
    public DateTime FechaGeneracion { get; set; }
}
