namespace Application.DTOs;

public class TareaEDTUpdateDto
{
    public Guid? Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Orden { get; set; }
    public int DuracionDias { get; set; }
    public string? Predecesoras { get; set; }
    public decimal Costo { get; set; }
    public string Responsable { get; set; } = string.Empty;
}
