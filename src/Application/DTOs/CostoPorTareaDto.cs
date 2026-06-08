namespace Application.DTOs;

public class CostoPorTareaDto
{
    public Guid TareaId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public decimal Costo { get; set; }
    public decimal PorcentajeDelBAC { get; set; }
}
