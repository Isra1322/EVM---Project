using Application.DTOs;
using Application.Interfaces;
using Application.Results;
using Domain.Entities;

namespace Application.Services;

public class ProyectoService : IProyectoService
{
    private readonly IProyectoRepository _proyectoRepository;
    private readonly IAIService _aiService;

    public ProyectoService(IProyectoRepository proyectoRepository, IAIService aiService)
    {
        _proyectoRepository = proyectoRepository;
        _aiService = aiService;
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

    public async Task<ServiceResult<IndicadoresEvmDto>> GetIndicadoresAsync(Guid id)
    {
        var proyecto = await _proyectoRepository.GetByIdAsync(id);

        if (proyecto is null)
        {
            return ServiceResult<IndicadoresEvmDto>.Fail("Proyecto no encontrado");
        }

        var diasTotales = (proyecto.FechaFin.Date - proyecto.FechaInicio.Date).TotalDays;

        if (diasTotales <= 0)
        {
            return ServiceResult<IndicadoresEvmDto>.Fail("Los dias totales del proyecto deben ser mayores a cero");
        }

        var diasTranscurridos = (proyecto.FechaCorte.Date - proyecto.FechaInicio.Date).TotalDays;
        var avancePlaneado = (decimal)(diasTranscurridos / diasTotales);

        var bac = proyecto.PresupuestoBAC;
        var ev = proyecto.ValorGanadoEV;
        var ac = proyecto.CostoRealAC;
        var pv = bac * avancePlaneado;
        var sv = ev - pv;
        var cv = ev - ac;
        var spi = pv == 0 ? 0 : ev / pv;
        var cpi = ac == 0 ? 0 : ev / ac;
        var eac = cpi == 0 ? 0 : bac / cpi;
        var etc = cpi == 0 ? 0 : eac - ac;
        var vac = bac - eac;
        var tcpi = bac - ac == 0 ? 0 : (bac - ev) / (bac - ac);

        var indicadores = new IndicadoresEvmDto
        {
            ProyectoId = proyecto.Id,
            NombreProyecto = proyecto.Nombre,
            PV = Round(pv),
            EV = Round(ev),
            AC = Round(ac),
            BAC = Round(bac),
            SV = Round(sv),
            CV = Round(cv),
            SPI = Round(spi),
            CPI = Round(cpi),
            EAC = Round(eac),
            ETC = Round(etc),
            VAC = Round(vac),
            TCPI = Round(tcpi)
        };

        return ServiceResult<IndicadoresEvmDto>.Ok(indicadores);
    }

    public async Task<ServiceResult<AnalisisEvmDto>> GetAnalisisAsync(Guid id)
    {
        var indicadoresResult = await GetIndicadoresAsync(id);

        if (!indicadoresResult.Success || indicadoresResult.Data is null)
        {
            return ServiceResult<AnalisisEvmDto>.Fail(indicadoresResult.Message);
        }

        var indicadores = indicadoresResult.Data;
        var estadoCronograma = indicadores.SPI > 1
            ? "Adelantado"
            : indicadores.SPI == 1 ? "En cronograma" : "Retrasado";
        var estadoCosto = indicadores.CPI > 1
            ? "Bajo presupuesto"
            : indicadores.CPI == 1 ? "Dentro del presupuesto" : "Sobre presupuesto";
        var nivelRiesgo = indicadores.SPI < 0.85m && indicadores.CPI < 0.85m
            ? "Alto"
            : indicadores.SPI < 1 || indicadores.CPI < 1 ? "Medio" : "Bajo";

        var recomendaciones = new List<string>();

        if (indicadores.SPI < 1)
        {
            recomendaciones.Add("Revisar actividades criticas y ajustar el cronograma.");
            recomendaciones.Add("Priorizar tareas con mayor impacto en el avance.");
        }

        if (indicadores.CPI < 1)
        {
            recomendaciones.Add("Controlar gastos pendientes y validar desviaciones de costo.");
            recomendaciones.Add("Revisar recursos y compras para reducir sobrecostos.");
        }

        if (indicadores.SPI >= 1 && indicadores.CPI >= 1)
        {
            recomendaciones.Add("Mantener el seguimiento periodico del cronograma y los costos.");
            recomendaciones.Add("Conservar las practicas actuales de control del proyecto.");
        }

        var analisis = new AnalisisEvmDto
        {
            ProyectoId = indicadores.ProyectoId,
            NombreProyecto = indicadores.NombreProyecto,
            EstadoCronograma = estadoCronograma,
            EstadoCosto = estadoCosto,
            NivelRiesgo = nivelRiesgo,
            Resumen = $"El proyecto esta {estadoCronograma.ToLower()} y {estadoCosto.ToLower()}. El nivel de riesgo es {nivelRiesgo.ToLower()}.",
            Recomendaciones = recomendaciones
        };

        return ServiceResult<AnalisisEvmDto>.Ok(analisis);
    }

    public async Task<ServiceResult<AnalisisIaDto>> GetAnalisisIaAsync(Guid id)
    {
        var indicadoresResult = await GetIndicadoresAsync(id);

        if (!indicadoresResult.Success || indicadoresResult.Data is null)
        {
            return ServiceResult<AnalisisIaDto>.Fail(indicadoresResult.Message);
        }

        var analisisBaseResult = await GetAnalisisAsync(id);

        if (!analisisBaseResult.Success || analisisBaseResult.Data is null)
        {
            return ServiceResult<AnalisisIaDto>.Fail(analisisBaseResult.Message);
        }

        var analisisGenerado = await _aiService.GenerarAnalisisProyectoAsync(
            indicadoresResult.Data,
            analisisBaseResult.Data);

        var analisisIa = new AnalisisIaDto
        {
            ProyectoId = indicadoresResult.Data.ProyectoId,
            NombreProyecto = indicadoresResult.Data.NombreProyecto,
            AnalisisGenerado = analisisGenerado,
            FechaGeneracion = DateTime.UtcNow
        };

        return ServiceResult<AnalisisIaDto>.Ok(analisisIa);
    }

    public async Task<ServiceResult<CurvaSDto>> GetCurvaSAsync(Guid id)
    {
        var proyecto = await _proyectoRepository.GetByIdAsync(id);

        if (proyecto is null)
        {
            return ServiceResult<CurvaSDto>.Fail("Proyecto no encontrado");
        }

        if (proyecto.FechaFin.Date <= proyecto.FechaInicio.Date)
        {
            return ServiceResult<CurvaSDto>.Fail("La fecha fin debe ser mayor que la fecha inicio");
        }

        var diasTotales = (int)(proyecto.FechaFin.Date - proyecto.FechaInicio.Date).TotalDays;
        var diasHastaCorte = (int)(proyecto.FechaCorte.Date - proyecto.FechaInicio.Date).TotalDays;
        var bac = proyecto.PresupuestoBAC;
        var puntos = new List<PuntoCurvaSDto>();

        for (var dia = 0; dia <= diasTotales; dia++)
        {
            var fecha = proyecto.FechaInicio.Date.AddDays(dia);
            var pv = bac * dia / diasTotales;
            var ev = CalculateValueUntilCutoff(proyecto.ValorGanadoEV, dia, diasHastaCorte);
            var ac = CalculateValueUntilCutoff(proyecto.CostoRealAC, dia, diasHastaCorte);

            puntos.Add(new PuntoCurvaSDto
            {
                Dia = dia,
                Fecha = fecha,
                PV = Round(pv),
                EV = Round(ev),
                AC = Round(ac),
                BAC = Round(bac)
            });
        }

        var curvaS = new CurvaSDto
        {
            ProyectoId = proyecto.Id,
            NombreProyecto = proyecto.Nombre,
            BAC = Round(bac),
            Puntos = puntos
        };

        return ServiceResult<CurvaSDto>.Ok(curvaS);
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

    public async Task<ServiceResult<ProyectoResponseDto>> UpdateAsync(Guid id, ProyectoUpdateDto dto)
    {
        var proyecto = await _proyectoRepository.GetByIdAsync(id);

        if (proyecto is null)
        {
            return ServiceResult<ProyectoResponseDto>.Fail("Proyecto no encontrado");
        }

        var validationError = ValidateProyecto(dto);

        if (validationError is not null)
        {
            return ServiceResult<ProyectoResponseDto>.Fail(validationError);
        }

        proyecto.Nombre = dto.Nombre.Trim();
        proyecto.FechaInicio = dto.FechaInicio;
        proyecto.FechaFin = dto.FechaFin;
        proyecto.FechaCorte = dto.FechaCorte;
        proyecto.ValorGanadoEV = dto.ValorGanadoEV;
        proyecto.CostoRealAC = dto.CostoRealAC;
        proyecto.PresupuestoBAC = dto.PresupuestoBAC;

        UpdateTareas(proyecto, dto.Tareas);

        await _proyectoRepository.UpdateAsync(proyecto);
        await _proyectoRepository.SaveChangesAsync();

        return ServiceResult<ProyectoResponseDto>.Ok(MapToResponseDto(proyecto), "Proyecto actualizado correctamente");
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
        return ValidateProyecto(dto.Nombre, dto.FechaInicio, dto.FechaFin, dto.FechaCorte);
    }

    private static string? ValidateProyecto(ProyectoUpdateDto dto)
    {
        return ValidateProyecto(dto.Nombre, dto.FechaInicio, dto.FechaFin, dto.FechaCorte);
    }

    private static string? ValidateProyecto(string nombre, DateTime fechaInicio, DateTime fechaFin, DateTime fechaCorte)
    {
        if (string.IsNullOrWhiteSpace(nombre))
        {
            return "El nombre del proyecto es obligatorio";
        }

        if (fechaFin < fechaInicio)
        {
            return "La fecha fin debe ser mayor o igual que la fecha inicio";
        }

        if (fechaCorte < fechaInicio || fechaCorte > fechaFin)
        {
            return "La fecha de corte debe estar entre la fecha inicio y la fecha fin";
        }

        return null;
    }

    private static void UpdateTareas(Proyecto proyecto, List<TareaEDTUpdateDto> tareasDto)
    {
        var tareasConId = tareasDto
            .Where(tarea => tarea.Id.HasValue)
            .Select(tarea => tarea.Id!.Value)
            .ToHashSet();

        var tareasAEliminar = proyecto.Tareas
            .Where(tarea => !tareasConId.Contains(tarea.Id))
            .ToList();

        foreach (var tarea in tareasAEliminar)
        {
            proyecto.Tareas.Remove(tarea);
        }

        foreach (var tareaDto in tareasDto)
        {
            if (tareaDto.Id.HasValue)
            {
                var tareaExistente = proyecto.Tareas.FirstOrDefault(tarea => tarea.Id == tareaDto.Id.Value);

                if (tareaExistente is not null)
                {
                    tareaExistente.Nombre = tareaDto.Nombre.Trim();
                    tareaExistente.DuracionDias = tareaDto.DuracionDias;
                    tareaExistente.Predecesoras = tareaDto.Predecesoras;
                    tareaExistente.Costo = tareaDto.Costo;
                    tareaExistente.Responsable = tareaDto.Responsable.Trim();
                }

                continue;
            }

            proyecto.Tareas.Add(new TareaEDT
            {
                Id = Guid.NewGuid(),
                ProyectoId = proyecto.Id,
                Nombre = tareaDto.Nombre.Trim(),
                DuracionDias = tareaDto.DuracionDias,
                Predecesoras = tareaDto.Predecesoras,
                Costo = tareaDto.Costo,
                Responsable = tareaDto.Responsable.Trim()
            });
        }
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

    private static decimal Round(decimal value)
    {
        return Math.Round(value, 2);
    }

    private static decimal CalculateValueUntilCutoff(decimal totalValue, int dia, int diasHastaCorte)
    {
        if (dia <= 0)
        {
            return 0;
        }

        if (diasHastaCorte <= 0 || dia >= diasHastaCorte)
        {
            return totalValue;
        }

        return totalValue * dia / diasHastaCorte;
    }
}
