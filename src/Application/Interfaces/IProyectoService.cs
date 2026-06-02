using Application.DTOs;
using Application.Results;

namespace Application.Interfaces;

public interface IProyectoService
{
    Task<ServiceResult<List<ProyectoResponseDto>>> GetAllAsync();
    Task<ServiceResult<ProyectoResponseDto>> GetByIdAsync(Guid id);
    Task<ServiceResult<IndicadoresEvmDto>> GetIndicadoresAsync(Guid id);
    Task<ServiceResult<AnalisisEvmDto>> GetAnalisisAsync(Guid id);
    Task<ServiceResult<AnalisisIaDto>> GetAnalisisIaAsync(Guid id);
    Task<ServiceResult<CurvaSDto>> GetCurvaSAsync(Guid id);
    Task<ServiceResult<ProyectoResponseDto>> CreateAsync(ProyectoCreateDto dto);
    Task<ServiceResult<ProyectoResponseDto>> UpdateAsync(Guid id, ProyectoUpdateDto dto);
    Task<ServiceResult<bool>> DeleteAsync(Guid id);
}
