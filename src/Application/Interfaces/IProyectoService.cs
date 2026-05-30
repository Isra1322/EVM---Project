using Application.DTOs;
using Application.Results;

namespace Application.Interfaces;

public interface IProyectoService
{
    Task<ServiceResult<List<ProyectoResponseDto>>> GetAllAsync();
    Task<ServiceResult<ProyectoResponseDto>> GetByIdAsync(Guid id);
    Task<ServiceResult<ProyectoResponseDto>> CreateAsync(ProyectoCreateDto dto);
    Task<ServiceResult<bool>> DeleteAsync(Guid id);
}
