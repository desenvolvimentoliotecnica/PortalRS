using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.FasesProcesso;

// ── DTOs ──

public sealed record FaseProcessoResponse(Guid Id, Guid ProjetoId, string Nome, int Ordem, ResponsavelFaseTipo ResponsavelTipo, int TotalCandidatos);

public sealed record FaseProcessoRequest(string Nome, ResponsavelFaseTipo ResponsavelTipo = ResponsavelFaseTipo.RH);

public sealed record MoverCandidatoRequest(Guid FaseDestinoId);

// ── Interface ──

public interface IFaseProcessoService
{
    Task<IReadOnlyList<FaseProcessoResponse>> ListAsync(Guid projetoId, CancellationToken ct);
    Task<FaseProcessoResponse> CreateAsync(Guid projetoId, FaseProcessoRequest request, CancellationToken ct);
    Task<FaseProcessoResponse?> UpdateAsync(Guid faseId, FaseProcessoRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid faseId, CancellationToken ct);
    Task ReorderAsync(Guid projetoId, List<Guid> orderedIds, CancellationToken ct);
    Task<bool> MoverCandidatoAsync(Guid projetoCandidatoId, MoverCandidatoRequest request, CancellationToken ct);
}

// ── Service ──

public sealed class FaseProcessoService : IFaseProcessoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public FaseProcessoService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<FaseProcessoResponse>> ListAsync(Guid projetoId, CancellationToken ct)
    {
        return await _db.Set<FaseProcesso>().AsNoTracking()
            .Where(f => f.ProjetoId == projetoId)
            .OrderBy(f => f.Ordem)
            .Select(f => new FaseProcessoResponse(
                f.Id, f.ProjetoId, f.Nome, f.Ordem, f.ResponsavelTipo,
                _db.Set<ProjetoCandidato>().Count(pc => pc.FaseAtualId == f.Id)))
            .ToListAsync(ct);
    }

    public async Task<FaseProcessoResponse> CreateAsync(Guid projetoId, FaseProcessoRequest request, CancellationToken ct)
    {
        var maxOrdem = await _db.Set<FaseProcesso>()
            .Where(f => f.ProjetoId == projetoId)
            .MaxAsync(f => (int?)f.Ordem, ct) ?? -1;

        var entity = new FaseProcesso
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            ProjetoId = projetoId,
            Nome = request.Nome.Trim(),
            Ordem = maxOrdem + 1,
            ResponsavelTipo = request.ResponsavelTipo,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<FaseProcesso>().Add(entity);
        await _db.SaveChangesAsync(ct);

        return new FaseProcessoResponse(entity.Id, entity.ProjetoId, entity.Nome, entity.Ordem, entity.ResponsavelTipo, 0);
    }

    public async Task<FaseProcessoResponse?> UpdateAsync(Guid faseId, FaseProcessoRequest request, CancellationToken ct)
    {
        var entity = await _db.Set<FaseProcesso>().FirstOrDefaultAsync(f => f.Id == faseId, ct);
        if (entity is null) return null;

        entity.Nome = request.Nome.Trim();
        entity.ResponsavelTipo = request.ResponsavelTipo;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var total = await _db.Set<ProjetoCandidato>().CountAsync(pc => pc.FaseAtualId == faseId, ct);
        return new FaseProcessoResponse(entity.Id, entity.ProjetoId, entity.Nome, entity.Ordem, entity.ResponsavelTipo, total);
    }

    public async Task<bool> DeleteAsync(Guid faseId, CancellationToken ct)
    {
        var entity = await _db.Set<FaseProcesso>().FirstOrDefaultAsync(f => f.Id == faseId, ct);
        if (entity is null) return false;

        // Move candidates in this phase to null (no phase)
        var candidates = await _db.Set<ProjetoCandidato>()
            .Where(pc => pc.FaseAtualId == faseId).ToListAsync(ct);
        foreach (var c in candidates) c.FaseAtualId = null;

        _db.Set<FaseProcesso>().Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task ReorderAsync(Guid projetoId, List<Guid> orderedIds, CancellationToken ct)
    {
        var all = await _db.Set<FaseProcesso>().Where(f => f.ProjetoId == projetoId).ToListAsync(ct);
        for (int i = 0; i < orderedIds.Count; i++)
        {
            var item = all.FirstOrDefault(f => f.Id == orderedIds[i]);
            if (item is not null)
            {
                item.Ordem = i;
                item.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task<bool> MoverCandidatoAsync(Guid projetoCandidatoId, MoverCandidatoRequest request, CancellationToken ct)
    {
        var pc = await _db.Set<ProjetoCandidato>().FirstOrDefaultAsync(x => x.Id == projetoCandidatoId, ct);
        if (pc is null) return false;

        pc.FaseAtualId = request.FaseDestinoId;
        pc.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
