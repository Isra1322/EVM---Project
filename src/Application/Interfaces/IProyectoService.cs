using Application.DTOs;
using Application.Results;

namespace Application.Interfaces;

public interface IProyectoService
{
    Task<ServiceResult<List<ProyectoResponseDto>>> GetAllAsync();
    Task<ServiceResult<ProyectoResponseDto>> GetByIdAsync(Guid id);
    Task<ServiceResult<IndicadoresEvmDto>> GetIndicadoresAsync(Guid id, Guid? corteId = null);
    Task<ServiceResult<AnalisisEvmDto>> GetAnalisisAsync(Guid id, Guid? corteId = null);
    Task<ServiceResult<AnalisisIaDto>> GetAnalisisIaAsync(Guid id, Guid? corteId = null);
    Task<ServiceResult<CurvaSDto>> GetCurvaSAsync(Guid id);
    Task<ServiceResult<List<EvolucionIndicadoresDto>>> GetEvolucionSpiCpiAsync(Guid id);
    Task<ServiceResult<List<CostoPorTareaDto>>> GetCostosPorTareaAsync(Guid id);
    Task<ServiceResult<ProyectoResponseDto>> CreateAsync(ProyectoCreateDto dto);
    Task<ServiceResult<ProyectoResponseDto>> UpdateAsync(Guid id, ProyectoUpdateDto dto);
    Task<ServiceResult<bool>> DeleteAsync(Guid id);
}
