using Application.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence.Context;

namespace Persistence.Repositories;

public class ProyectoRepository : IProyectoRepository
{
    private readonly AppDbContext _context;

    public ProyectoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Proyecto>> GetAllAsync()
    {
        return await _context.Proyectos
            .Include(proyecto => proyecto.Tareas)
            .Include(proyecto => proyecto.Cortes)
            .ToListAsync();
    }

    public async Task<Proyecto?> GetByIdAsync(Guid id)
    {
        return await _context.Proyectos
            .Include(proyecto => proyecto.Tareas)
            .Include(proyecto => proyecto.Cortes)
            .FirstOrDefaultAsync(proyecto => proyecto.Id == id);
    }

    public async Task AddAsync(Proyecto proyecto)
    {
        await _context.Proyectos.AddAsync(proyecto);
    }

    public Task UpdateAsync(Proyecto proyecto)
    {
        _context.Proyectos.Update(proyecto);

        return Task.CompletedTask;
    }

    public Task DeleteAsync(Proyecto proyecto)
    {
        _context.Proyectos.Remove(proyecto);

        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
