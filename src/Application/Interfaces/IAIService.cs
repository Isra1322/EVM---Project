using Application.DTOs;

namespace Application.Interfaces;

public interface IAIService
{
    Task<string> GenerarAnalisisProyectoAsync(IndicadoresEvmDto indicadores, AnalisisEvmDto analisisBase);
}
