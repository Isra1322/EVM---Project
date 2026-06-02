namespace Application.DTOs;

public class AnalisisEvmDto
{
    public Guid ProyectoId { get; set; }
    public string NombreProyecto { get; set; } = string.Empty;
    public string EstadoCronograma { get; set; } = string.Empty;
    public string EstadoCosto { get; set; } = string.Empty;
    public string NivelRiesgo { get; set; } = string.Empty;
    public string Resumen { get; set; } = string.Empty;
    public List<string> Recomendaciones { get; set; } = new();
}
