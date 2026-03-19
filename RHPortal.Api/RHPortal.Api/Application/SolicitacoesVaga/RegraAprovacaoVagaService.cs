using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesVaga;

// ── DTOs ──

public sealed record RegraAprovacaoVagaResponse(
    Guid Id,
    Guid? SolicitanteRoleId,
    string? SolicitanteRoleNome,
    Guid Aprovador1FuncionarioId,
    string? Aprovador1Nome,
    Guid? Aprovador2FuncionarioId,
    string? Aprovador2Nome,
    bool Aprovador2Habilitado,
    bool Ativo,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed class RegraAprovacaoVagaCreateRequest
{
    /// <summary>Id do Role do solicitante. Null = regra padrão para qualquer perfil.</summary>
    public Guid? SolicitanteRoleId { get; set; }
    public Guid Aprovador1FuncionarioId { get; set; }
    public Guid? Aprovador2FuncionarioId { get; set; }
    public bool Aprovador2Habilitado { get; set; }
}

public sealed class RegraAprovacaoVagaUpdateRequest
{
    public Guid Aprovador1FuncionarioId { get; set; }
    public Guid? Aprovador2FuncionarioId { get; set; }
    public bool Aprovador2Habilitado { get; set; }
    public bool Ativo { get; set; }
}

// ── Interface ──

public interface IRegraAprovacaoVagaService
{
    Task<IReadOnlyList<RegraAprovacaoVagaResponse>> ListAsync(CancellationToken ct);
    Task<RegraAprovacaoVagaResponse> CreateAsync(RegraAprovacaoVagaCreateRequest request, CancellationToken ct);
    Task<RegraAprovacaoVagaResponse?> UpdateAsync(Guid id, RegraAprovacaoVagaUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

// ── Implementação ──

public sealed class RegraAprovacaoVagaService : IRegraAprovacaoVagaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public RegraAprovacaoVagaService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<RegraAprovacaoVagaResponse>> ListAsync(CancellationToken ct)
    {
        var items = await _db.RegrasAprovacaoVaga
            .AsNoTracking()
            .Include(r => r.SolicitanteRole)
            .Include(r => r.Aprovador1)
            .Include(r => r.Aprovador2)
            .OrderBy(r => r.SolicitanteRoleId == null ? 1 : 0)
            .ThenBy(r => r.SolicitanteRole != null ? r.SolicitanteRole.Name : "")
            .ToListAsync(ct);

        return items.Select(Map).ToList();
    }

    public async Task<RegraAprovacaoVagaResponse> CreateAsync(
        RegraAprovacaoVagaCreateRequest request, CancellationToken ct)
    {
        var jaExiste = await _db.RegrasAprovacaoVaga
            .AnyAsync(r => r.Ativo && r.SolicitanteRoleId == request.SolicitanteRoleId, ct);

        if (jaExiste)
        {
            var descricao = request.SolicitanteRoleId.HasValue
                ? "o perfil selecionado"
                : "regra padrão (todos os perfis)";
            throw new InvalidOperationException(
                $"Já existe uma regra ativa para {descricao}. " +
                "Desative ou edite a regra existente antes de criar uma nova.");
        }

        var entity = new RegraAprovacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteRoleId = request.SolicitanteRoleId,
            Aprovador1FuncionarioId = request.Aprovador1FuncionarioId,
            Aprovador2FuncionarioId = request.Aprovador2FuncionarioId,
            Aprovador2Habilitado = request.Aprovador2Habilitado,
            Ativo = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.RegrasAprovacaoVaga.Add(entity);
        await _db.SaveChangesAsync(ct);

        return await LoadResponseAsync(entity.Id, ct);
    }

    public async Task<RegraAprovacaoVagaResponse?> UpdateAsync(
        Guid id, RegraAprovacaoVagaUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.RegrasAprovacaoVaga.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (entity is null) return null;

        entity.Aprovador1FuncionarioId = request.Aprovador1FuncionarioId;
        entity.Aprovador2FuncionarioId = request.Aprovador2FuncionarioId;
        entity.Aprovador2Habilitado = request.Aprovador2Habilitado;
        entity.Ativo = request.Ativo;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await LoadResponseAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.RegrasAprovacaoVaga.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (entity is null) return false;

        _db.RegrasAprovacaoVaga.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<RegraAprovacaoVagaResponse> LoadResponseAsync(Guid id, CancellationToken ct)
    {
        var r = await _db.RegrasAprovacaoVaga
            .AsNoTracking()
            .Include(x => x.SolicitanteRole)
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .FirstAsync(x => x.Id == id, ct);
        return Map(r);
    }

    private static RegraAprovacaoVagaResponse Map(RegraAprovacaoVaga r) => new(
        r.Id,
        r.SolicitanteRoleId,
        r.SolicitanteRole?.Name,
        r.Aprovador1FuncionarioId,
        r.Aprovador1?.Name,
        r.Aprovador2FuncionarioId,
        r.Aprovador2?.Name,
        r.Aprovador2Habilitado,
        r.Ativo,
        r.CreatedAtUtc,
        r.UpdatedAtUtc
    );
}
