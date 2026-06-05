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

    public async Task<ServiceResult<IndicadoresEvmDto>> GetIndicadoresAsync(Guid id, Guid? corteId = null)
    {
        var proyecto = await _proyectoRepository.GetByIdAsync(id);

        if (proyecto is null)
        {
            return ServiceResult<IndicadoresEvmDto>.Fail("Proyecto no encontrado");
        }

        var corte = SelectCorte(proyecto, corteId);

        if (corte is null)
        {
            return ServiceResult<IndicadoresEvmDto>.Fail(corteId.HasValue
                ? "Fecha de corte no encontrada"
                : "El proyecto no tiene fechas de corte registradas");
        }

        var fechaFinCalculada = TryCalculateProjectEndDate(
            proyecto.FechaInicio,
            proyecto.UnidadTiempo,
            proyecto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var fechaFinIndicadores,
            out var fechaFinError)
            ? fechaFinIndicadores
            : proyecto.FechaFin.Date;

        if (fechaFinError is not null)
        {
            return ServiceResult<IndicadoresEvmDto>.Fail(fechaFinError);
        }
        var diasTotales = (fechaFinCalculada - proyecto.FechaInicio.Date).TotalDays;

        if (diasTotales <= 0)
        {
            return ServiceResult<IndicadoresEvmDto>.Fail("Los dias totales del proyecto deben ser mayores a cero");
        }

        var bac = proyecto.PresupuestoBAC;
        var ev = corte.ValorGanadoEV;
        var ac = corte.CostoRealAC;
        var plannedCurve = BuildPlannedValueCurve(proyecto, bac);
        var pv = GetPlannedValueAtDate(plannedCurve, corte.FechaCorte.Date);
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
            CorteId = corte.Id,
            NombreProyecto = proyecto.Nombre,
            UnidadTiempo = proyecto.UnidadTiempo,
            Duracion = Round(CalculateDuration(diasTotales, proyecto.UnidadTiempo)),
            FechaInicio = proyecto.FechaInicio,
            FechaFin = fechaFinCalculada,
            FechaCorte = corte.FechaCorte,
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

    public async Task<ServiceResult<AnalisisEvmDto>> GetAnalisisAsync(Guid id, Guid? corteId = null)
    {
        var indicadoresResult = await GetIndicadoresAsync(id, corteId);

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

    public async Task<ServiceResult<AnalisisIaDto>> GetAnalisisIaAsync(Guid id, Guid? corteId = null)
    {
        var indicadoresResult = await GetIndicadoresAsync(id, corteId);

        if (!indicadoresResult.Success || indicadoresResult.Data is null)
        {
            return ServiceResult<AnalisisIaDto>.Fail(indicadoresResult.Message);
        }

        var analisisBaseResult = await GetAnalisisAsync(id, corteId);

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

        var fechaFinCalculada = TryCalculateProjectEndDate(
            proyecto.FechaInicio,
            proyecto.UnidadTiempo,
            proyecto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var fechaFinCurva,
            out var fechaFinError)
            ? fechaFinCurva
            : proyecto.FechaFin.Date;

        if (fechaFinError is not null)
        {
            return ServiceResult<CurvaSDto>.Fail(fechaFinError);
        }

        if (fechaFinCalculada <= proyecto.FechaInicio.Date)
        {
            return ServiceResult<CurvaSDto>.Fail("La fecha fin debe ser mayor que la fecha inicio");
        }

        var diasTotales = (int)(fechaFinCalculada - proyecto.FechaInicio.Date).TotalDays;
        var bac = proyecto.PresupuestoBAC;
        var plannedCurve = BuildPlannedValueCurve(proyecto, bac);
        var cortesPorFecha = proyecto.Cortes
            .GroupBy(corte => corte.FechaCorte.Date)
            .ToDictionary(group => group.Key, group => group.OrderBy(corte => corte.FechaCorte).Last());
        var puntos = new List<PuntoCurvaSDto>();

        for (var dia = 0; dia <= diasTotales; dia++)
        {
            var fecha = proyecto.FechaInicio.Date.AddDays(dia);
            var pv = GetPlannedValueAtDate(plannedCurve, fecha);
            cortesPorFecha.TryGetValue(fecha, out var corte);

            puntos.Add(new PuntoCurvaSDto
            {
                Dia = dia,
                Fecha = fecha,
                PV = Round(pv),
                EV = Round(corte?.ValorGanadoEV ?? 0),
                AC = Round(corte?.CostoRealAC ?? 0),
                BAC = Round(bac)
            });
        }

        var curvaS = new CurvaSDto
        {
            ProyectoId = proyecto.Id,
            NombreProyecto = proyecto.Nombre,
            BAC = Round(bac),
            Puntos = puntos,
            Cortes = proyecto.Cortes
                .OrderBy(corte => corte.FechaCorte)
                .Select(corte => new CorteCurvaSDto
                {
                    CorteId = corte.Id,
                    FechaCorte = corte.FechaCorte,
                    EV = Round(corte.ValorGanadoEV),
                    AC = Round(corte.CostoRealAC)
                })
                .ToList()
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
        if (!TryCalculateProjectEndDate(
            dto.FechaInicio,
            dto.UnidadTiempo,
            dto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var fechaFinCalculada,
            out var fechaFinError))
        {
            return ServiceResult<ProyectoResponseDto>.Fail(fechaFinError ?? "No se pudo calcular la fecha fin del proyecto");
        }

        var proyecto = new Proyecto
        {
            Id = proyectoId,
            Nombre = dto.Nombre.Trim(),
            UnidadTiempo = dto.UnidadTiempo.Trim(),
            AdministradorProyecto = dto.AdministradorProyecto.Trim(),
            AsistenteProyecto = dto.AsistenteProyecto.Trim(),
            FechaInicio = dto.FechaInicio,
            FechaFin = fechaFinCalculada,
            FechaCorte = GetCompatibilityFechaCorte(dto.Cortes, dto.FechaCorte),
            ValorGanadoEV = GetCompatibilityValorGanadoEV(dto.Cortes, dto.ValorGanadoEV),
            CostoRealAC = GetCompatibilityCostoRealAC(dto.Cortes, dto.CostoRealAC),
            PresupuestoBAC = dto.PresupuestoBAC,
            FechaCreacion = DateTime.UtcNow,
            Tareas = dto.Tareas.Select((tarea, index) => new TareaEDT
            {
                Id = Guid.NewGuid(),
                ProyectoId = proyectoId,
                Nombre = tarea.Nombre.Trim(),
                Orden = index + 1,
                DuracionDias = tarea.DuracionDias,
                Predecesoras = tarea.Predecesoras,
                Costo = tarea.Costo,
                Responsable = tarea.Responsable.Trim()
            }).ToList(),
            Cortes = dto.Cortes
                .OrderBy(corte => corte.FechaCorte)
                .Select(corte => new CorteProyecto
                {
                    Id = Guid.NewGuid(),
                    ProyectoId = proyectoId,
                    FechaCorte = corte.FechaCorte,
                    ValorGanadoEV = corte.ValorGanadoEV,
                    CostoRealAC = corte.CostoRealAC
                })
                .ToList()
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
        proyecto.UnidadTiempo = dto.UnidadTiempo.Trim();
        proyecto.AdministradorProyecto = dto.AdministradorProyecto.Trim();
        proyecto.AsistenteProyecto = dto.AsistenteProyecto.Trim();
        proyecto.FechaInicio = dto.FechaInicio;
        if (!TryCalculateProjectEndDate(
            dto.FechaInicio,
            dto.UnidadTiempo,
            dto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var fechaFinCalculada,
            out var fechaFinError))
        {
            return ServiceResult<ProyectoResponseDto>.Fail(fechaFinError ?? "No se pudo calcular la fecha fin del proyecto");
        }

        proyecto.FechaFin = fechaFinCalculada;
        proyecto.FechaCorte = GetCompatibilityFechaCorte(dto.Cortes, dto.FechaCorte);
        proyecto.ValorGanadoEV = GetCompatibilityValorGanadoEV(dto.Cortes, dto.ValorGanadoEV);
        proyecto.CostoRealAC = GetCompatibilityCostoRealAC(dto.Cortes, dto.CostoRealAC);
        proyecto.PresupuestoBAC = dto.PresupuestoBAC;

        UpdateTareas(proyecto, dto.Tareas);
        UpdateCortes(proyecto, dto.Cortes);

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
        return ValidateProyecto(
            dto.Nombre,
            dto.UnidadTiempo,
            dto.AdministradorProyecto,
            dto.AsistenteProyecto,
            dto.FechaInicio,
            dto.FechaFin,
            dto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Costo, tarea.Predecesoras)),
            dto.Cortes.Select(corte => (corte.FechaCorte, corte.ValorGanadoEV, corte.CostoRealAC)));
    }

    private static string? ValidateProyecto(ProyectoUpdateDto dto)
    {
        return ValidateProyecto(
            dto.Nombre,
            dto.UnidadTiempo,
            dto.AdministradorProyecto,
            dto.AsistenteProyecto,
            dto.FechaInicio,
            dto.FechaFin,
            dto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Costo, tarea.Predecesoras)),
            dto.Cortes.Select(corte => (corte.FechaCorte, corte.ValorGanadoEV, corte.CostoRealAC)));
    }

    private static string? ValidateProyecto(
        string nombre,
        string unidadTiempo,
        string administradorProyecto,
        string asistenteProyecto,
        DateTime fechaInicio,
        DateTime fechaFin,
        IEnumerable<(int DuracionDias, decimal Costo, string? Predecesoras)> tareas,
        IEnumerable<(DateTime FechaCorte, decimal ValorGanadoEV, decimal CostoRealAC)> cortes)
    {
        if (string.IsNullOrWhiteSpace(nombre))
        {
            return "El nombre del proyecto es obligatorio";
        }

        if (string.IsNullOrWhiteSpace(unidadTiempo))
        {
            return "La unidad de tiempo es obligatoria";
        }

        if (!IsValidUnidadTiempo(unidadTiempo))
        {
            return "La unidad de tiempo debe ser Dias, Semanas o Meses";
        }

        if (string.IsNullOrWhiteSpace(administradorProyecto))
        {
            return "El administrador del proyecto es obligatorio";
        }

        if (string.IsNullOrWhiteSpace(asistenteProyecto))
        {
            return "El asistente del proyecto es obligatorio";
        }

        var tareasList = tareas.ToList();

        if (tareasList.Count == 0)
        {
            return "Debe registrar al menos una tarea EDT";
        }

        var validationTareasError = ValidarTareasEdt(tareasList);

        if (validationTareasError is not null)
        {
            return validationTareasError;
        }

        var bacCalculado = tareasList.Sum(tarea => tarea.Costo);
        if (!TryCalculateProjectDurationDays(
            unidadTiempo,
            tareasList.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var duracionTotal,
            out var scheduleError))
        {
            return scheduleError ?? "No se pudo calcular la duracion del proyecto desde la EDT";
        }

        var fechaFinCalculada = fechaInicio.Date.AddDays(duracionTotal);

        if (bacCalculado <= 0)
        {
            return "El BAC calculado desde las tareas EDT debe ser mayor a cero";
        }

        if (duracionTotal <= 0)
        {
            return "La duracion total de las tareas EDT debe ser mayor a cero";
        }

        if (fechaFinCalculada <= fechaInicio.Date)
        {
            return "La fecha fin debe ser mayor que la fecha inicio";
        }

        var cortesList = cortes.ToList();

        if (cortesList.Count == 0)
        {
            return "Debe registrar al menos una fecha de corte";
        }

        if (cortesList.Any(corte => corte.FechaCorte.Date < fechaInicio.Date || corte.FechaCorte.Date > fechaFinCalculada))
        {
            return "Cada fecha de corte debe estar entre la fecha inicio y la fecha fin";
        }

        if (cortesList.Any(corte => corte.ValorGanadoEV < 0))
        {
            return "El valor ganado EV no puede ser negativo";
        }

        if (cortesList.Any(corte => corte.ValorGanadoEV > bacCalculado))
        {
            return "El valor ganado EV no puede ser mayor que el BAC del proyecto";
        }

        if (cortesList.Any(corte => corte.CostoRealAC < 0))
        {
            return "El costo real AC no puede ser negativo";
        }

        if (cortesList.Select(corte => corte.FechaCorte.Date).Distinct().Count() != cortesList.Count)
        {
            return "Las fechas de corte no deben repetirse dentro del mismo proyecto";
        }

        return null;
    }

    private static string? ValidarTareasEdt(List<(int DuracionDias, decimal Costo, string? Predecesoras)> tareas)
    {
        if (tareas.Any(tarea => tarea.DuracionDias <= 0))
        {
            return "Ninguna tarea EDT puede tener duracion menor o igual a cero";
        }

        var predecesorasPorTarea = new Dictionary<int, List<int>>();
        var sucesoras = new HashSet<int>();

        for (var index = 0; index < tareas.Count; index++)
        {
            var numeroTarea = index + 1;
            var predecesoras = ParsearPredecesoras(tareas[index].Predecesoras, numeroTarea, tareas.Count, out var parseError);

            if (parseError is not null)
            {
                return parseError;
            }

            if (numeroTarea > 1 && predecesoras.Count == 0)
            {
                return $"La tarea {numeroTarea} debe tener al menos una predecesora";
            }

            predecesorasPorTarea[numeroTarea] = predecesoras;

            foreach (var predecesora in predecesoras)
            {
                sucesoras.Add(predecesora);
            }
        }

        var cycleError = DetectarCiclos(predecesorasPorTarea);

        if (cycleError is not null)
        {
            return cycleError;
        }

        var tareasSinSucesoras = Enumerable.Range(1, tareas.Count)
            .Where(numeroTarea => !sucesoras.Contains(numeroTarea))
            .ToList();

        if (tareasSinSucesoras.Count > 1)
        {
            return $"Solo puede existir una tarea final sin sucesoras. Tareas sin sucesoras: {string.Join(", ", tareasSinSucesoras)}";
        }

        return null;
    }

    private static List<int> ParsearPredecesoras(
        string? predecesoras,
        int numeroTarea,
        int totalTareas,
        out string? error)
    {
        error = null;

        if (string.IsNullOrWhiteSpace(predecesoras))
        {
            return new List<int>();
        }

        var result = new List<int>();
        var partes = predecesoras.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

        foreach (var parte in partes)
        {
            if (!int.TryParse(parte, out var numeroPredecesora))
            {
                error = $"La predecesora \"{parte}\" de la tarea {numeroTarea} no es un numero valido";
                return new List<int>();
            }

            if (numeroPredecesora < 1 || numeroPredecesora > totalTareas)
            {
                error = $"La tarea {numeroTarea} referencia la predecesora {numeroPredecesora}, pero esa tarea no existe";
                return new List<int>();
            }

            result.Add(numeroPredecesora);
        }

        return result.Distinct().ToList();
    }

    private static string? DetectarCiclos(Dictionary<int, List<int>> predecesorasPorTarea)
    {
        var visitando = new HashSet<int>();
        var visitadas = new HashSet<int>();

        foreach (var numeroTarea in predecesorasPorTarea.Keys)
        {
            if (TieneCiclo(numeroTarea))
            {
                return $"Se detecto una dependencia circular en la tarea {numeroTarea}";
            }
        }

        return null;

        bool TieneCiclo(int numeroTarea)
        {
            if (visitando.Contains(numeroTarea))
            {
                return true;
            }

            if (visitadas.Contains(numeroTarea))
            {
                return false;
            }

            visitando.Add(numeroTarea);

            foreach (var predecesora in predecesorasPorTarea[numeroTarea])
            {
                if (TieneCiclo(predecesora))
                {
                    return true;
                }
            }

            visitando.Remove(numeroTarea);
            visitadas.Add(numeroTarea);

            return false;
        }
    }

    private static bool IsValidUnidadTiempo(string unidadTiempo)
    {
        return string.Equals(unidadTiempo, "Dias", StringComparison.OrdinalIgnoreCase)
            || string.Equals(unidadTiempo, "Semanas", StringComparison.OrdinalIgnoreCase)
            || string.Equals(unidadTiempo, "Meses", StringComparison.OrdinalIgnoreCase);
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

        for (var index = 0; index < tareasDto.Count; index++)
        {
            var tareaDto = tareasDto[index];
            var orden = index + 1;

            if (tareaDto.Id.HasValue)
            {
                var tareaExistente = proyecto.Tareas.FirstOrDefault(tarea => tarea.Id == tareaDto.Id.Value);

                if (tareaExistente is not null)
                {
                    tareaExistente.Nombre = tareaDto.Nombre.Trim();
                    tareaExistente.Orden = orden;
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
                Orden = orden,
                DuracionDias = tareaDto.DuracionDias,
                Predecesoras = tareaDto.Predecesoras,
                Costo = tareaDto.Costo,
                Responsable = tareaDto.Responsable.Trim()
            });
        }
    }

    private static void UpdateCortes(Proyecto proyecto, List<CorteProyectoUpdateDto> cortesDto)
    {
        var cortesConId = cortesDto
            .Where(corte => corte.Id.HasValue)
            .Select(corte => corte.Id!.Value)
            .ToHashSet();

        var cortesAEliminar = proyecto.Cortes
            .Where(corte => !cortesConId.Contains(corte.Id))
            .ToList();

        foreach (var corte in cortesAEliminar)
        {
            proyecto.Cortes.Remove(corte);
        }

        foreach (var corteDto in cortesDto)
        {
            if (corteDto.Id.HasValue)
            {
                var corteExistente = proyecto.Cortes.FirstOrDefault(corte => corte.Id == corteDto.Id.Value);

                if (corteExistente is not null)
                {
                    corteExistente.FechaCorte = corteDto.FechaCorte;
                    corteExistente.ValorGanadoEV = corteDto.ValorGanadoEV;
                    corteExistente.CostoRealAC = corteDto.CostoRealAC;
                }

                continue;
            }

            proyecto.Cortes.Add(new CorteProyecto
            {
                Id = Guid.NewGuid(),
                ProyectoId = proyecto.Id,
                FechaCorte = corteDto.FechaCorte,
                ValorGanadoEV = corteDto.ValorGanadoEV,
                CostoRealAC = corteDto.CostoRealAC
            });
        }
    }

    private static CorteProyecto? SelectCorte(Proyecto proyecto, Guid? corteId = null)
    {
        if (corteId.HasValue)
        {
            return proyecto.Cortes.FirstOrDefault(corte => corte.Id == corteId.Value);
        }

        return proyecto.Cortes
            .OrderByDescending(corte => corte.FechaCorte)
            .FirstOrDefault();
    }

    private static DateTime GetCompatibilityFechaCorte(List<CorteProyectoCreateDto> cortes, DateTime fallback)
    {
        return cortes.OrderByDescending(corte => corte.FechaCorte).FirstOrDefault()?.FechaCorte ?? fallback;
    }

    private static DateTime GetCompatibilityFechaCorte(List<CorteProyectoUpdateDto> cortes, DateTime fallback)
    {
        return cortes.OrderByDescending(corte => corte.FechaCorte).FirstOrDefault()?.FechaCorte ?? fallback;
    }

    private static decimal GetCompatibilityValorGanadoEV(List<CorteProyectoCreateDto> cortes, decimal fallback)
    {
        return cortes.OrderByDescending(corte => corte.FechaCorte).FirstOrDefault()?.ValorGanadoEV ?? fallback;
    }

    private static decimal GetCompatibilityValorGanadoEV(List<CorteProyectoUpdateDto> cortes, decimal fallback)
    {
        return cortes.OrderByDescending(corte => corte.FechaCorte).FirstOrDefault()?.ValorGanadoEV ?? fallback;
    }

    private static decimal GetCompatibilityCostoRealAC(List<CorteProyectoCreateDto> cortes, decimal fallback)
    {
        return cortes.OrderByDescending(corte => corte.FechaCorte).FirstOrDefault()?.CostoRealAC ?? fallback;
    }

    private static decimal GetCompatibilityCostoRealAC(List<CorteProyectoUpdateDto> cortes, decimal fallback)
    {
        return cortes.OrderByDescending(corte => corte.FechaCorte).FirstOrDefault()?.CostoRealAC ?? fallback;
    }

    private static ProyectoResponseDto MapToResponseDto(Proyecto proyecto)
    {
        var fechaFinCalculada = TryCalculateProjectEndDate(
            proyecto.FechaInicio,
            proyecto.UnidadTiempo,
            proyecto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var fechaFinMapeada,
            out _)
            ? fechaFinMapeada
            : proyecto.FechaFin.Date;

        return new ProyectoResponseDto
        {
            Id = proyecto.Id,
            Nombre = proyecto.Nombre,
            UnidadTiempo = proyecto.UnidadTiempo,
            AdministradorProyecto = proyecto.AdministradorProyecto,
            AsistenteProyecto = proyecto.AsistenteProyecto,
            FechaInicio = proyecto.FechaInicio,
            FechaFin = fechaFinCalculada,
            FechaCorte = proyecto.FechaCorte,
            ValorGanadoEV = proyecto.ValorGanadoEV,
            CostoRealAC = proyecto.CostoRealAC,
            PresupuestoBAC = proyecto.PresupuestoBAC,
            FechaCreacion = proyecto.FechaCreacion,
            Tareas = proyecto.Tareas
                .OrderBy(tarea => tarea.Orden == 0 ? int.MaxValue : tarea.Orden)
                .ThenBy(tarea => tarea.Id)
                .Select(MapToResponseDto)
                .ToList(),
            Cortes = proyecto.Cortes
                .OrderBy(corte => corte.FechaCorte)
                .Select(MapToResponseDto)
                .ToList()
        };
    }

    private static TareaEDTResponseDto MapToResponseDto(TareaEDT tarea)
    {
        return new TareaEDTResponseDto
        {
            Id = tarea.Id,
            ProyectoId = tarea.ProyectoId,
            Nombre = tarea.Nombre,
            Orden = tarea.Orden,
            DuracionDias = tarea.DuracionDias,
            Predecesoras = tarea.Predecesoras,
            Costo = tarea.Costo,
            Responsable = tarea.Responsable
        };
    }

    private static CorteProyectoResponseDto MapToResponseDto(CorteProyecto corte)
    {
        return new CorteProyectoResponseDto
        {
            Id = corte.Id,
            ProyectoId = corte.ProyectoId,
            FechaCorte = corte.FechaCorte,
            ValorGanadoEV = corte.ValorGanadoEV,
            CostoRealAC = corte.CostoRealAC
        };
    }

    private static bool TryCalculateProjectEndDate(
        DateTime fechaInicio,
        string unidadTiempo,
        IEnumerable<(int DuracionDias, string? Predecesoras)> tareas,
        out DateTime fechaFin,
        out string? error)
    {
        fechaFin = fechaInicio.Date;

        if (!TryCalculateProjectDurationDays(unidadTiempo, tareas, out var duracionCriticaDias, out error))
        {
            return false;
        }

        fechaFin = fechaInicio.Date.AddDays(duracionCriticaDias);

        return true;
    }

    private static bool TryCalculateProjectDurationDays(
        string unidadTiempo,
        IEnumerable<(int DuracionDias, string? Predecesoras)> tareas,
        out int durationDays,
        out string? error)
    {
        durationDays = 0;
        var taskList = tareas.ToList();

        if (taskList.Count == 0)
        {
            error = null;
            return true;
        }

        if (!TryBuildEarlySchedule(
            unidadTiempo,
            taskList.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var schedule,
            out error))
        {
            return false;
        }

        durationDays = schedule.EarlyFinishByTask.Max();

        return true;
    }

    private static SortedDictionary<DateTime, decimal> BuildPlannedValueCurve(Proyecto proyecto, decimal bac)
    {
        var startDate = proyecto.FechaInicio.Date;
        var endDate = TryCalculateProjectEndDate(
            proyecto.FechaInicio,
            proyecto.UnidadTiempo,
            proyecto.Tareas.Select(tarea => (tarea.DuracionDias, tarea.Predecesoras)),
            out var calculatedEndDate,
            out _)
            ? calculatedEndDate
            : proyecto.FechaFin.Date;
        var tasks = proyecto.Tareas
            .OrderBy(tarea => tarea.Orden == 0 ? int.MaxValue : tarea.Orden)
            .ThenBy(tarea => tarea.Id)
            .ToList();
        var dailyPlannedCost = new Dictionary<int, decimal>();
        if (!TryBuildEarlySchedule(
            proyecto.UnidadTiempo,
            tasks.Select(task => (task.DuracionDias, task.Predecesoras)),
            out var schedule,
            out _))
        {
            return new SortedDictionary<DateTime, decimal>
            {
                [startDate] = 0,
                [endDate] = Round(bac)
            };
        }

        for (var index = 0; index < tasks.Count; index++)
        {
            var task = tasks[index];
            var earlyStart = schedule.EarlyStartByTask[index];
            var earlyFinish = schedule.EarlyFinishByTask[index];
            var durationDays = schedule.DurationDaysByTask[index];
            var plannedCostPerDay = task.Costo / durationDays;

            for (var day = earlyStart + 1; day <= earlyFinish; day++)
            {
                dailyPlannedCost[day] = dailyPlannedCost.GetValueOrDefault(day) + plannedCostPerDay;
            }
        }

        var curve = new SortedDictionary<DateTime, decimal>();
        var totalDays = Math.Max(0, (int)(endDate - startDate).TotalDays);
        var accumulated = 0m;

        for (var day = 0; day <= totalDays; day++)
        {
            accumulated += dailyPlannedCost.GetValueOrDefault(day);

            if (day == totalDays && accumulated > bac)
            {
                accumulated = bac;
            }

            curve[startDate.AddDays(day)] = Round(accumulated);
        }

        return curve;
    }

    private static bool TryBuildEarlySchedule(
        string unidadTiempo,
        IEnumerable<(int DuracionDias, string? Predecesoras)> tareas,
        out EarlySchedule schedule,
        out string? error)
    {
        var taskList = tareas.ToList();
        var predecessorNumbersByTask = new List<int>[taskList.Count];
        var durationDaysByTask = new int[taskList.Count];
        var earlyStartByTask = new int[taskList.Count];
        var earlyFinishByTask = new int[taskList.Count];
        var stateByTask = new int[taskList.Count];
        string? scheduleError = null;

        schedule = new EarlySchedule(earlyStartByTask, earlyFinishByTask, durationDaysByTask);
        error = null;

        for (var index = 0; index < taskList.Count; index++)
        {
            var task = taskList[index];
            var taskNumber = index + 1;
            predecessorNumbersByTask[index] = ParsearPredecesoras(task.Predecesoras, taskNumber, taskList.Count, out var parseError);

            if (parseError is not null)
            {
                error = parseError;
                return false;
            }

            durationDaysByTask[index] = ConvertTaskDurationToDays(task.DuracionDias, unidadTiempo);
        }

        for (var index = 0; index < taskList.Count; index++)
        {
            if (!TryCalculateEarlySchedule(index))
            {
                error = scheduleError ?? "No se pudo calcular la planificacion EDT";
                return false;
            }
        }

        return true;

        bool TryCalculateEarlySchedule(int taskIndex)
        {
            if (stateByTask[taskIndex] == 2)
            {
                return true;
            }

            if (stateByTask[taskIndex] == 1)
            {
                scheduleError = $"Se detecto una dependencia circular en la tarea {taskIndex + 1}";
                return false;
            }

            stateByTask[taskIndex] = 1;
            var predecessors = predecessorNumbersByTask[taskIndex];
            var earlyStart = 0;

            foreach (var predecessor in predecessors)
            {
                var predecessorIndex = predecessor - 1;

                if (!TryCalculateEarlySchedule(predecessorIndex))
                {
                    return false;
                }

                earlyStart = Math.Max(earlyStart, earlyFinishByTask[predecessorIndex]);
            }

            earlyStartByTask[taskIndex] = earlyStart;
            earlyFinishByTask[taskIndex] = earlyStart + durationDaysByTask[taskIndex];
            stateByTask[taskIndex] = 2;

            return true;
        }
    }

    private static decimal GetPlannedValueAtDate(SortedDictionary<DateTime, decimal> plannedCurve, DateTime date)
    {
        if (plannedCurve.Count == 0)
        {
            return 0;
        }

        var targetDate = date.Date;
        var firstPoint = plannedCurve.First();
        var lastPoint = plannedCurve.Last();

        if (targetDate <= firstPoint.Key)
        {
            return firstPoint.Value;
        }

        if (targetDate >= lastPoint.Key)
        {
            return lastPoint.Value;
        }

        return plannedCurve.Last(point => point.Key <= targetDate).Value;
    }

    private static int ConvertTaskDurationToDays(int duration, string unidadTiempo)
    {
        if (string.Equals(unidadTiempo, "Semanas", StringComparison.OrdinalIgnoreCase))
        {
            return duration * 7;
        }

        if (string.Equals(unidadTiempo, "Meses", StringComparison.OrdinalIgnoreCase))
        {
            return duration * 30;
        }

        return duration;
    }

    private sealed record EarlySchedule(
        int[] EarlyStartByTask,
        int[] EarlyFinishByTask,
        int[] DurationDaysByTask);

    private static decimal Round(decimal value)
    {
        return Math.Round(value, 2);
    }

    private static decimal CalculateDuration(double totalDays, string unidadTiempo)
    {
        var days = (decimal)totalDays;

        if (string.Equals(unidadTiempo, "Semanas", StringComparison.OrdinalIgnoreCase))
        {
            return days / 7;
        }

        if (string.Equals(unidadTiempo, "Meses", StringComparison.OrdinalIgnoreCase))
        {
            return days / 30;
        }

        return days;
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
