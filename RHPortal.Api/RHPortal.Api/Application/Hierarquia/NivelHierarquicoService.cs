using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Hierarquia;

public interface INivelHierarquicoService
{
    Task<IReadOnlyList<NivelHierarquicoResponse>> ListAsync(CancellationToken ct);
    Task<NivelHierarquicoResponse> CreateAsync(NivelHierarquicoRequest request, CancellationToken ct);
    Task<NivelHierarquicoResponse?> UpdateAsync(Guid id, NivelHierarquicoRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task ReorderAsync(List<Guid> orderedIds, CancellationToken ct);
}

// ── DTOs ──

public sealed record NivelHierarquicoRequest(string Nome);

public sealed record NivelHierarquicoResponse(Guid Id, string Nome, int Ordem, bool Ativo, DateTimeOffset CreatedAtUtc);

// ── Service ──

public sealed class NivelHierarquicoService : INivelHierarquicoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public NivelHierarquicoService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<NivelHierarquicoResponse>> ListAsync(CancellationToken ct)
    {
        return await _db.Set<NivelHierarquico>().AsNoTracking()
            .OrderBy(n => n.Ordem)
            .Select(n => new NivelHierarquicoResponse(n.Id, n.Nome, n.Ordem, n.Ativo, n.CreatedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<NivelHierarquicoResponse> CreateAsync(NivelHierarquicoRequest request, CancellationToken ct)
    {
        var maxOrdem = await _db.Set<NivelHierarquico>().MaxAsync(n => (int?)n.Ordem, ct) ?? -1;

        var entity = new NivelHierarquico
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            Nome = request.Nome.Trim(),
            Ordem = maxOrdem + 1,
            Ativo = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<NivelHierarquico>().Add(entity);
        await _db.SaveChangesAsync(ct);
        return new NivelHierarquicoResponse(entity.Id, entity.Nome, entity.Ordem, entity.Ativo, entity.CreatedAtUtc);
    }

    public async Task<NivelHierarquicoResponse?> UpdateAsync(Guid id, NivelHierarquicoRequest request, CancellationToken ct)
    {
        var entity = await _db.Set<NivelHierarquico>().FirstOrDefaultAsync(n => n.Id == id, ct);
        if (entity is null) return null;

        entity.Nome = request.Nome.Trim();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return new NivelHierarquicoResponse(entity.Id, entity.Nome, entity.Ordem, entity.Ativo, entity.CreatedAtUtc);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Set<NivelHierarquico>().FirstOrDefaultAsync(n => n.Id == id, ct);
        if (entity is null) return false;

        entity.Ativo = false;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task ReorderAsync(List<Guid> orderedIds, CancellationToken ct)
    {
        var all = await _db.Set<NivelHierarquico>().ToListAsync(ct);
        for (int i = 0; i < orderedIds.Count; i++)
        {
            var item = all.FirstOrDefault(n => n.Id == orderedIds[i]);
            if (item is not null)
            {
                item.Ordem = i;
                item.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }
        await _db.SaveChangesAsync(ct);
    }
}
