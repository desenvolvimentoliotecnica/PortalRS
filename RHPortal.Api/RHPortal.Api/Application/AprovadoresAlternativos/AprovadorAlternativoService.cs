using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.AprovadoresAlternativos;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.AprovadoresAlternativos;

public interface IAprovadorAlternativoService
{
    Task<PagedResult<AprovadorAlternativoResponse>> ListAsync(AprovadorAlternativoListQuery query, CancellationToken ct);
    Task<AprovadorAlternativoResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<AprovadorAlternativoResponse> CreateAsync(AprovadorAlternativoSaveRequest request, CancellationToken ct);
    Task<AprovadorAlternativoResponse?> UpdateAsync(Guid id, AprovadorAlternativoSaveRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class AprovadorAlternativoService : IAprovadorAlternativoService
{
    private readonly AppDbContext _db;

    public AprovadorAlternativoService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<AprovadorAlternativoResponse>> ListAsync(AprovadorAlternativoListQuery query, CancellationToken ct)
    {
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var page = Math.Max(1, query.Page ?? 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);

        var q = _db.AprovadoresAlternativos
            .AsNoTracking()
            .Include(x => x.Gestor)
            .Include(x => x.Aprovador)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var search = query.Q.Trim().ToLower();
            q = q.Where(x =>
                (x.Gestor != null && x.Gestor.Name.ToLower().Contains(search)) ||
                (x.Aprovador != null && x.Aprovador.Name.ToLower().Contains(search)));
        }

        if (query.ApenasAtivos == true)
        {
            q = q.Where(x => x.DataInicio <= hoje && (x.DataFim == null || x.DataFim >= hoje));
        }

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(x => x.Gestor!.Name)
            .ThenBy(x => x.DataInicio)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling((double)total / pageSize);
        return new PagedResult<AprovadorAlternativoResponse>(
            items.Select(x => MapToResponse(x, hoje)).ToList(),
            page, pageSize, total, totalPages);
    }

    public async Task<AprovadorAlternativoResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.AprovadoresAlternativos
            .AsNoTracking()
            .Include(x => x.Gestor)
            .Include(x => x.Aprovador)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return entity is null ? null : MapToResponse(entity, DateOnly.FromDateTime(DateTime.UtcNow));
    }

    public async Task<AprovadorAlternativoResponse> CreateAsync(AprovadorAlternativoSaveRequest request, CancellationToken ct)
    {
        var entity = new AprovadorAlternativo
        {
            Id = Guid.NewGuid(),
            GestorId = request.GestorId,
            AprovadorId = request.AprovadorId,
            DataInicio = request.DataInicio,
            DataFim = request.DataFim,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.AprovadoresAlternativos.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<AprovadorAlternativoResponse?> UpdateAsync(Guid id, AprovadorAlternativoSaveRequest request, CancellationToken ct)
    {
        var entity = await _db.AprovadoresAlternativos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        entity.GestorId = request.GestorId;
        entity.AprovadorId = request.AprovadorId;
        entity.DataInicio = request.DataInicio;
        entity.DataFim = request.DataFim;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.AprovadoresAlternativos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        _db.AprovadoresAlternativos.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static AprovadorAlternativoResponse MapToResponse(AprovadorAlternativo x, DateOnly hoje) =>
        new(
            x.Id,
            x.GestorId,
            x.Gestor?.Name ?? string.Empty,
            x.AprovadorId,
            x.Aprovador?.Name ?? string.Empty,
            x.DataInicio,
            x.DataFim,
            x.DataInicio <= hoje && (x.DataFim == null || x.DataFim >= hoje),
            x.CreatedAtUtc
        );
}
