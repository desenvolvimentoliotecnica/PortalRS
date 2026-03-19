using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.CamposPersonalizados;

// ── DTOs ──

public sealed record CampoPersonalizadoResponse(
    Guid Id, Guid VagaId, string Label, CampoPersonalizadoTipo Tipo,
    bool Obrigatorio, bool IsReadOnly, string? ValorPadrao, int Ordem, string? Opcoes);

public sealed record CampoPersonalizadoRequest(
    string Label, CampoPersonalizadoTipo Tipo = CampoPersonalizadoTipo.Texto,
    bool Obrigatorio = false, bool IsReadOnly = false, string? ValorPadrao = null, string? Opcoes = null);

// ── Interface ──

public interface ICampoPersonalizadoService
{
    Task<IReadOnlyList<CampoPersonalizadoResponse>> ListAsync(Guid vagaId, CancellationToken ct);
    Task<CampoPersonalizadoResponse> CreateAsync(Guid vagaId, CampoPersonalizadoRequest request, CancellationToken ct);
    Task<CampoPersonalizadoResponse?> UpdateAsync(Guid campoId, CampoPersonalizadoRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid campoId, CancellationToken ct);
    Task ReorderAsync(Guid vagaId, List<Guid> orderedIds, CancellationToken ct);
}

// ── Service ──

public sealed class CampoPersonalizadoService : ICampoPersonalizadoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public CampoPersonalizadoService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<CampoPersonalizadoResponse>> ListAsync(Guid vagaId, CancellationToken ct)
    {
        return await _db.Set<CampoPersonalizadoVaga>().AsNoTracking()
            .Where(c => c.VagaId == vagaId)
            .OrderBy(c => c.Ordem)
            .Select(c => new CampoPersonalizadoResponse(c.Id, c.VagaId, c.Label, c.Tipo, c.Obrigatorio, c.IsReadOnly, c.ValorPadrao, c.Ordem, c.Opcoes))
            .ToListAsync(ct);
    }

    public async Task<CampoPersonalizadoResponse> CreateAsync(Guid vagaId, CampoPersonalizadoRequest request, CancellationToken ct)
    {
        var maxOrdem = await _db.Set<CampoPersonalizadoVaga>()
            .Where(c => c.VagaId == vagaId)
            .MaxAsync(c => (int?)c.Ordem, ct) ?? -1;

        var entity = new CampoPersonalizadoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            VagaId = vagaId,
            Label = request.Label.Trim(),
            Tipo = request.Tipo,
            Obrigatorio = request.Obrigatorio,
            IsReadOnly = request.IsReadOnly,
            ValorPadrao = request.ValorPadrao?.Trim(),
            Ordem = maxOrdem + 1,
            Opcoes = request.Opcoes?.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<CampoPersonalizadoVaga>().Add(entity);
        await _db.SaveChangesAsync(ct);

        return new CampoPersonalizadoResponse(entity.Id, entity.VagaId, entity.Label, entity.Tipo, entity.Obrigatorio, entity.IsReadOnly, entity.ValorPadrao, entity.Ordem, entity.Opcoes);
    }

    public async Task<CampoPersonalizadoResponse?> UpdateAsync(Guid campoId, CampoPersonalizadoRequest request, CancellationToken ct)
    {
        var entity = await _db.Set<CampoPersonalizadoVaga>().FirstOrDefaultAsync(c => c.Id == campoId, ct);
        if (entity is null) return null;

        entity.Label = request.Label.Trim();
        entity.Tipo = request.Tipo;
        entity.Obrigatorio = request.Obrigatorio;
        entity.IsReadOnly = request.IsReadOnly;
        entity.ValorPadrao = request.ValorPadrao?.Trim();
        entity.Opcoes = request.Opcoes?.Trim();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new CampoPersonalizadoResponse(entity.Id, entity.VagaId, entity.Label, entity.Tipo, entity.Obrigatorio, entity.IsReadOnly, entity.ValorPadrao, entity.Ordem, entity.Opcoes);
    }

    public async Task<bool> DeleteAsync(Guid campoId, CancellationToken ct)
    {
        var entity = await _db.Set<CampoPersonalizadoVaga>().FirstOrDefaultAsync(c => c.Id == campoId, ct);
        if (entity is null) return false;
        _db.Set<CampoPersonalizadoVaga>().Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task ReorderAsync(Guid vagaId, List<Guid> orderedIds, CancellationToken ct)
    {
        var all = await _db.Set<CampoPersonalizadoVaga>().Where(c => c.VagaId == vagaId).ToListAsync(ct);
        for (int i = 0; i < orderedIds.Count; i++)
        {
            var item = all.FirstOrDefault(c => c.Id == orderedIds[i]);
            if (item is not null) { item.Ordem = i; item.UpdatedAtUtc = DateTimeOffset.UtcNow; }
        }
        await _db.SaveChangesAsync(ct);
    }
}
