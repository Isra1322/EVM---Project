using Domain.Entities;

namespace Application.Interfaces;

public interface IProyectoRepository
{
    Task<List<Proyecto>> GetAllAsync();
    Task<Proyecto?> GetByIdAsync(Guid id);
    Task AddAsync(Proyecto proyecto);
    Task UpdateAsync(Proyecto proyecto);
    Task DeleteAsync(Proyecto proyecto);
    Task SaveChangesAsync();
}
