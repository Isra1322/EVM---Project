namespace Application.DTOs;

public class CurvaSDto
{
    public Guid ProyectoId { get; set; }
    public string NombreProyecto { get; set; } = string.Empty;
    public decimal BAC { get; set; }
    public List<PuntoCurvaSDto> Puntos { get; set; } = new();
}
