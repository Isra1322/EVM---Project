using Application.DTOs;
using Application.Interfaces;
using Application.Results;
using Domain.Entities;

namespace Application.Services;

public class ProyectoService : IProyectoService
{
    private readonly IProyectoRepository _proyectoRepository;

    public ProyectoService(IProyectoRepository proyectoRepository)
    {
        _proyectoRepository = proyectoRepository;
    }

    public async Task<ServiceResult<List<ProyectoResponseDto>>> GetAllAsync()
    {
        var proyectos = await _proyectoRepository.GetAllAsync();
        var response = proyectos.Select(MapToResponseDto).ToList();

        return ServiceResult<List<ProyectoResponseDto>>.Ok(response);
    }

    public async Task<ServiceResult<ProyectoResponseDto>> GetByIdAsync(Guid id)
    {
        var proyecto = await _proyectoRepository.GetByIdAsync(id);

        if (proyecto is null)
        {
            return ServiceResult<ProyectoResponseDto>.Fail("Proyecto no encontrado");
        }

        return ServiceResult<ProyectoResponseDto>.Ok(MapToResponseDto(proyecto));
    }

    public async Task<ServiceResult<ProyectoResponseDto>> CreateAsync(ProyectoCreateDto dto)
    {
        var validationError = ValidateProyecto(dto);

        if (validationError is not null)
        {
            return ServiceResult<ProyectoResponseDto>.Fail(validationError);
        }

        var proyectoId = Guid.NewGuid();
        var proyecto = new Proyecto
        {
            Id = proyectoId,
            Nombre = dto.Nombre.Trim(),
            FechaInicio = dto.FechaInicio,
            FechaFin = dto.FechaFin,
            FechaCorte = dto.FechaCorte,
            ValorGanadoEV = dto.ValorGanadoEV,
            CostoRealAC = dto.CostoRealAC,
            PresupuestoBAC = dto.PresupuestoBAC,
            FechaCreacion = DateTime.UtcNow,
            Tareas = dto.Tareas.Select(tarea => new TareaEDT
            {
                Id = Guid.NewGuid(),
                ProyectoId = proyectoId,
                Nombre = tarea.Nombre.Trim(),
                DuracionDias = tarea.DuracionDias,
                Predecesoras = tarea.Predecesoras,
                Costo = tarea.Costo,
                Responsable = tarea.Responsable.Trim()
            }).ToList()
        };

        await _proyectoRepository.AddAsync(proyecto);
        await _proyectoRepository.SaveChangesAsync();

        return ServiceResult<ProyectoResponseDto>.Ok(MapToResponseDto(proyecto), "Proyecto creado correctamente");
    }

    public async Task<ServiceResult<bool>> DeleteAsync(Guid id)
    {
        var proyecto = await _proyectoRepository.GetByIdAsync(id);

        if (proyecto is null)
        {
            return ServiceResult<bool>.Fail("Proyecto no encontrado");
        }

        await _proyectoRepository.DeleteAsync(proyecto);
        await _proyectoRepository.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true, "Proyecto eliminado correctamente");
    }

    private static string? ValidateProyecto(ProyectoCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre))
        {
            return "El nombre del proyecto es obligatorio";
        }

        if (dto.FechaFin < dto.FechaInicio)
        {
            return "La fecha fin debe ser mayor o igual que la fecha inicio";
        }

        if (dto.FechaCorte < dto.FechaInicio || dto.FechaCorte > dto.FechaFin)
        {
            return "La fecha de corte debe estar entre la fecha inicio y la fecha fin";
        }

        return null;
    }

    private static ProyectoResponseDto MapToResponseDto(Proyecto proyecto)
    {
        return new ProyectoResponseDto
        {
            Id = proyecto.Id,
            Nombre = proyecto.Nombre,
            FechaInicio = proyecto.FechaInicio,
            FechaFin = proyecto.FechaFin,
            FechaCorte = proyecto.FechaCorte,
            ValorGanadoEV = proyecto.ValorGanadoEV,
            CostoRealAC = proyecto.CostoRealAC,
            PresupuestoBAC = proyecto.PresupuestoBAC,
            FechaCreacion = proyecto.FechaCreacion,
            Tareas = proyecto.Tareas.Select(MapToResponseDto).ToList()
        };
    }

    private static TareaEDTResponseDto MapToResponseDto(TareaEDT tarea)
    {
        return new TareaEDTResponseDto
        {
            Id = tarea.Id,
            ProyectoId = tarea.ProyectoId,
            Nombre = tarea.Nombre,
            DuracionDias = tarea.DuracionDias,
            Predecesoras = tarea.Predecesoras,
            Costo = tarea.Costo,
            Responsable = tarea.Responsable
        };
    }
}
