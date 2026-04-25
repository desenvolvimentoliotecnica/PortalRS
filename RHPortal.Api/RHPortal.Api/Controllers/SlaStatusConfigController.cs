using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>Configuração de SLA por status para cada tipo de entidade do tenant.</summary>
[ApiController]
[Route("api/configuracoes/sla-status")]
[Authorize]
public sealed class SlaStatusConfigController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _currentUser;
    private readonly ITenantContext _tenantContext;

    public SlaStatusConfigController(
        AppDbContext db,
        ICurrentUserContext currentUser,
        ITenantContext tenantContext)
    {
        _db = db;
        _currentUser = currentUser;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Retorna todas as configurações de SLA do tenant agrupadas por tipo de entidade,
    /// incluindo os status possíveis que ainda não têm configuração.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SlaStatusConfigGroupResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var configs = await _db.SlaStatusConfigs
            .AsNoTracking()
            .ToListAsync(ct);

        var result = BuildGroupedResponse(configs);
        return Ok(result);
    }

    /// <summary>
    /// Upsert em batch das configurações de SLA (somente Admin).
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(IReadOnlyList<SlaStatusConfigGroupResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] IReadOnlyList<SlaStatusConfigUpsertItem> items, CancellationToken ct)
    {
        if (!_currentUser.IsAdmin)
            return Forbid();

        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant não identificado.");
        var now = DateTimeOffset.UtcNow;

        foreach (var item in items)
        {
            var existing = await _db.SlaStatusConfigs
                .FirstOrDefaultAsync(x => x.TipoEntidade == item.TipoEntidade && x.Status == item.Status, ct);

            if (existing is null)
            {
                _db.SlaStatusConfigs.Add(new SlaStatusConfig
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    TipoEntidade = item.TipoEntidade,
                    Status = item.Status,
                    SlaHoras = item.SlaHoras,
                    Ativo = item.Ativo,
                    UpdatedAtUtc = now,
                });
            }
            else
            {
                existing.SlaHoras = item.SlaHoras;
                existing.Ativo = item.Ativo;
                existing.UpdatedAtUtc = now;
            }
        }

        await _db.SaveChangesAsync(ct);

        var all = await _db.SlaStatusConfigs.AsNoTracking().ToListAsync(ct);
        return Ok(BuildGroupedResponse(all));
    }

    private static IReadOnlyList<SlaStatusConfigGroupResponse> BuildGroupedResponse(IReadOnlyList<SlaStatusConfig> configs)
    {
        var configMap = configs.ToDictionary(c => (c.TipoEntidade, c.Status));
        var result = new List<SlaStatusConfigGroupResponse>();

        foreach (var (tipo, statuses) in AllStatusesByTipo)
        {
            var items = statuses.Select(s =>
            {
                configMap.TryGetValue((tipo, s), out var cfg);
                return new SlaStatusConfigItemResponse(
                    TipoEntidade: tipo,
                    Status: s,
                    SlaHoras: cfg?.SlaHoras,
                    Ativo: cfg?.Ativo ?? false,
                    ConfiguradoId: cfg?.Id
                );
            }).ToList();

            result.Add(new SlaStatusConfigGroupResponse(tipo, items));
        }

        return result;
    }

    private static readonly IReadOnlyDictionary<TipoEntidadeStatus, IReadOnlyList<string>> AllStatusesByTipo =
        new Dictionary<TipoEntidadeStatus, IReadOnlyList<string>>
        {
            [TipoEntidadeStatus.SolicitacaoVaga] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.SolicitacaoDesligamento] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.SolicitacaoPromocao] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.SolicitacaoFerias] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.SolicitacaoBeneficio] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.SolicitacaoDependente] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.SolicitacaoEndereco] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.SolicitacaoPagamentoExtra] = GetEnumNames<SolicitacaoStatus>(),
            [TipoEntidadeStatus.Vaga] = GetEnumNames<VagaStatus>(),
        };

    private static IReadOnlyList<string> GetEnumNames<T>() where T : struct, Enum =>
        Enum.GetNames<T>();
}

public record SlaStatusConfigGroupResponse(
    TipoEntidadeStatus TipoEntidade,
    IReadOnlyList<SlaStatusConfigItemResponse> Itens
);

public record SlaStatusConfigItemResponse(
    TipoEntidadeStatus TipoEntidade,
    string Status,
    int? SlaHoras,
    bool Ativo,
    Guid? ConfiguradoId
);

public record SlaStatusConfigUpsertItem(
    TipoEntidadeStatus TipoEntidade,
    string Status,
    int SlaHoras,
    bool Ativo
);
