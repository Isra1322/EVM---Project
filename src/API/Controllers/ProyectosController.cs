using Application.DTOs;
using Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProyectosController : ControllerBase
{
    private readonly IProyectoService _proyectoService;

    public ProyectosController(IProyectoService proyectoService)
    {
        _proyectoService = proyectoService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _proyectoService.GetAllAsync();

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _proyectoService.GetByIdAsync(id);

        if (!result.Success)
        {
            return NotFound(result);
        }

        return Ok(result);
    }

    [HttpGet("{id:guid}/indicadores")]
    public async Task<IActionResult> GetIndicadores(Guid id)
    {
        var result = await _proyectoService.GetIndicadoresAsync(id);

        if (!result.Success && result.Message == "Proyecto no encontrado")
        {
            return NotFound(result);
        }

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet("{id:guid}/analisis")]
    public async Task<IActionResult> GetAnalisis(Guid id)
    {
        var result = await _proyectoService.GetAnalisisAsync(id);

        if (!result.Success && result.Message == "Proyecto no encontrado")
        {
            return NotFound(result);
        }

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet("{id:guid}/analisis-ia")]
    public async Task<IActionResult> GetAnalisisIa(Guid id)
    {
        var result = await _proyectoService.GetAnalisisIaAsync(id);

        if (!result.Success && result.Message == "Proyecto no encontrado")
        {
            return NotFound(result);
        }

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet("{id:guid}/curva-s")]
    public async Task<IActionResult> GetCurvaS(Guid id)
    {
        var result = await _proyectoService.GetCurvaSAsync(id);

        if (!result.Success && result.Message == "Proyecto no encontrado")
        {
            return NotFound(result);
        }

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(ProyectoCreateDto dto)
    {
        var result = await _proyectoService.CreateAsync(dto);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ProyectoUpdateDto dto)
    {
        var result = await _proyectoService.UpdateAsync(id, dto);

        if (!result.Success && result.Message == "Proyecto no encontrado")
        {
            return NotFound(result);
        }

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _proyectoService.DeleteAsync(id);

        if (!result.Success)
        {
            return NotFound(result);
        }

        return Ok(result);
    }
}
