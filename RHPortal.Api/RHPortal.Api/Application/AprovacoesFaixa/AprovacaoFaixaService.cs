using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using System.Security.Claims;

namespace RhPortal.Api.Application.AprovacoesFaixa;

// ── DTOs ──

public sealed record AprovacaoFaixaResponse(
    Guid Id, Guid FaixaSalarialId, string? CargoNome,
    decimal SalarioMinimoAtual, decimal SalarioMaximoAtual,
    decimal ValorProposto, string? Justificativa,
    StatusAprovacaoFaixa Status,
    string? SolicitanteNome, string? AprovadorNome, string? ObservacaoAprovador,
    DateTimeOffset CreatedAtUtc, DateTimeOffset? AprovadoEmUtc);

public sealed record SolicitarAprovacaoFaixaRequest(
    Guid FaixaSalarialId, decimal ValorProposto, string? Justificativa);

public sealed record AcaoAprovacaoFaixaRequest(string? Observacao);

// ── Interface ──

public interface IAprovacaoFaixaService
{
    Task<IReadOnlyList<AprovacaoFaixaResponse>> ListPendentesAsync(CancellationToken ct);
    Task<IReadOnlyList<AprovacaoFaixaResponse>> ListTodasAsync(CancellationToken ct);
    Task<AprovacaoFaixaResponse> SolicitarAsync(SolicitarAprovacaoFaixaRequest request, ClaimsPrincipal user, CancellationToken ct);
    Task<AprovacaoFaixaResponse?> AprovarAsync(Guid id, AcaoAprovacaoFaixaRequest request, ClaimsPrincipal user, CancellationToken ct);
    Task<AprovacaoFaixaResponse?> ReprovarAsync(Guid id, AcaoAprovacaoFaixaRequest request, ClaimsPrincipal user, CancellationToken ct);
}

// ── Service ──

public sealed class AprovacaoFaixaService : IAprovacaoFaixaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public AprovacaoFaixaService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    private IQueryable<AprovacaoFaixaSalarial> BaseQuery()
        => _db.Set<AprovacaoFaixaSalarial>().AsNoTracking()
            .Include(a => a.FaixaSalarial).ThenInclude(f => f!.JobPosition)
            .Include(a => a.Solicitante)
            .Include(a => a.Aprovador);

    private static AprovacaoFaixaResponse Map(AprovacaoFaixaSalarial a) => new(
        a.Id, a.FaixaSalarialId,
        a.FaixaSalarial?.JobPosition?.Name,
        a.FaixaSalarial?.SalarioMinimo ?? 0, a.FaixaSalarial?.SalarioMaximo ?? 0,
        a.ValorProposto, a.Justificativa, a.Status,
        a.Solicitante?.Name, a.Aprovador?.Name, a.ObservacaoAprovador,
        a.CreatedAtUtc, a.AprovadoEmUtc);

    public async Task<IReadOnlyList<AprovacaoFaixaResponse>> ListPendentesAsync(CancellationToken ct)
    {
        var items = await BaseQuery().Where(a => a.Status == StatusAprovacaoFaixa.Pendente)
            .OrderBy(a => a.CreatedAtUtc).ToListAsync(ct);
        return items.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<AprovacaoFaixaResponse>> ListTodasAsync(CancellationToken ct)
    {
        var items = await BaseQuery().OrderByDescending(a => a.CreatedAtUtc).ToListAsync(ct);
        return items.Select(Map).ToList();
    }

    public async Task<AprovacaoFaixaResponse> SolicitarAsync(SolicitarAprovacaoFaixaRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var faixa = await _db.FaixasSalariais.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == request.FaixaSalarialId, ct)
            ?? throw new InvalidOperationException("Faixa salarial não encontrada.");

        var userIdStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        Guid? userGuid = Guid.TryParse(userIdStr, out var uid) ? uid : null;
        var solicitante = userGuid.HasValue
            ? await _db.Funcionarios.AsNoTracking().FirstOrDefaultAsync(f => f.UserId == userGuid.Value, ct)
            : null;

        var entity = new AprovacaoFaixaSalarial
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            FaixaSalarialId = request.FaixaSalarialId,
            SolicitanteId = solicitante?.Id,
            ValorProposto = request.ValorProposto,
            Justificativa = request.Justificativa?.Trim(),
            Status = StatusAprovacaoFaixa.Pendente,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<AprovacaoFaixaSalarial>().Add(entity);
        await _db.SaveChangesAsync(ct);

        return Map(entity);
    }

    public async Task<AprovacaoFaixaResponse?> AprovarAsync(Guid id, AcaoAprovacaoFaixaRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var entity = await _db.Set<AprovacaoFaixaSalarial>()
            .Include(a => a.FaixaSalarial)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (entity is null) return null;

        var userIdStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        Guid? userGuid = Guid.TryParse(userIdStr, out var uid) ? uid : null;
        var aprovador = userGuid.HasValue
            ? await _db.Funcionarios.AsNoTracking().FirstOrDefaultAsync(f => f.UserId == userGuid.Value, ct)
            : null;

        entity.Status = StatusAprovacaoFaixa.Aprovada;
        entity.AprovadorId = aprovador?.Id;
        entity.ObservacaoAprovador = request.Observacao?.Trim();
        entity.AprovadoEmUtc = DateTimeOffset.UtcNow;

        // Update the faixa salarial with the approved value
        if (entity.FaixaSalarial != null)
        {
            entity.FaixaSalarial.SalarioMaximo = entity.ValorProposto;
            entity.FaixaSalarial.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return Map(entity);
    }

    public async Task<AprovacaoFaixaResponse?> ReprovarAsync(Guid id, AcaoAprovacaoFaixaRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var entity = await _db.Set<AprovacaoFaixaSalarial>().FirstOrDefaultAsync(a => a.Id == id, ct);
        if (entity is null) return null;

        var userIdStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        Guid? userGuid = Guid.TryParse(userIdStr, out var uid) ? uid : null;
        var aprovador = userGuid.HasValue
            ? await _db.Funcionarios.AsNoTracking().FirstOrDefaultAsync(f => f.UserId == userGuid.Value, ct)
            : null;

        entity.Status = StatusAprovacaoFaixa.Reprovada;
        entity.AprovadorId = aprovador?.Id;
        entity.ObservacaoAprovador = request.Observacao?.Trim();
        entity.AprovadoEmUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Map(entity);
    }
}
