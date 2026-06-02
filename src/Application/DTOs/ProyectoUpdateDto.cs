namespace Application.DTOs;

public class ProyectoUpdateDto
{
    public string Nombre { get; set; } = string.Empty;
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public DateTime FechaCorte { get; set; }
    public decimal ValorGanadoEV { get; set; }
    public decimal CostoRealAC { get; set; }
    public decimal PresupuestoBAC { get; set; }
    public List<TareaEDTUpdateDto> Tareas { get; set; } = new();
}
