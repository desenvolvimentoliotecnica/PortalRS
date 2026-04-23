using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Aprovacoes;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Agregador de aprovações pendentes para o usuário logado (sino de notificações + lista unificada).
/// </summary>
[ApiController]
[Route("api/aprovacoes")]
public sealed class AprovacoesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _userContext;

    public AprovacoesController(AppDbContext db, ICurrentUserContext userContext)
    {
        _db = db;
        _userContext = userContext;
    }

    /// <summary>
    /// Contagem total de aprovações pendentes para o usuário logado.
    /// Inclui todos os tipos que usam SolicitacaoAprovacaoEtapa.
    /// </summary>
    [HttpGet("pendentes/count")]
    [ProducesResponseType(typeof(PendentesCountResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendentesCount(CancellationToken ct)
    {
        var userId = _userContext.UserId;
        if (userId is null || userId == Guid.Empty)
            return Ok(new PendentesCountResponse(0));

        var funcId = _userContext.FuncionarioId;

        var userRoleIds = await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == userId.Value)
            .Select(ur => ur.RoleId)
            .ToListAsync(ct);

        var count = await _db.SolicitacoesAprovacaoEtapa
            .AsNoTracking()
            .Where(e => e.Status == StatusAprovacao.Pendente
                && ((funcId.HasValue && e.AprovadorId == funcId.Value)
                    || (e.RoleFilaId.HasValue && userRoleIds.Contains(e.RoleFilaId.Value)
                        && e.AprovadorId == null && e.AssumedByUserId == null)
                    || e.AssumedByUserId == userId.Value))
            .Select(e => e.SolicitacaoId)
            .Distinct()
            .CountAsync(ct);

        return Ok(new PendentesCountResponse(count));
    }

    /// <summary>
    /// Lista unificada de todos os itens pendentes de ação do usuário logado,
    /// independente do tipo de solicitação. Mantém as telas por tipo inalteradas.
    /// </summary>
    [HttpGet("pendentes")]
    [ProducesResponseType(typeof(IReadOnlyList<PendingItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendentes(CancellationToken ct)
    {
        var userId = _userContext.UserId;
        if (userId is null || userId == Guid.Empty)
            return Ok(Array.Empty<PendingItemResponse>());

        var funcId = _userContext.FuncionarioId;

        var userRoleIds = await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == userId.Value)
            .Select(ur => ur.RoleId)
            .ToListAsync(ct);

        // 1. Etapas pendentes onde o usuário pode agir
        var etapas = await _db.SolicitacoesAprovacaoEtapa
            .AsNoTracking()
            .Where(e => e.Status == StatusAprovacao.Pendente
                && ((funcId.HasValue && e.AprovadorId == funcId.Value)
                    || (e.RoleFilaId.HasValue && userRoleIds.Contains(e.RoleFilaId.Value)
                        && e.AprovadorId == null && e.AssumedByUserId == null)
                    || e.AssumedByUserId == userId.Value))
            .ToListAsync(ct);

        if (etapas.Count == 0)
            return Ok(Array.Empty<PendingItemResponse>());

        // 2. Etapa ativa por solicitação (menor Ordem)
        var etapaAtivaPorSolicitacao = etapas
            .GroupBy(e => e.SolicitacaoId)
            .ToDictionary(g => g.Key, g => g.OrderBy(e => e.Ordem).First());

        var solicitacaoIds = etapaAtivaPorSolicitacao.Keys.ToList();

        // 3. Agrupar por TipoFluxo para batch-load
        var idsPorFluxo = etapaAtivaPorSolicitacao.Values
            .GroupBy(e => e.TipoFluxo)
            .ToDictionary(g => g.Key, g => g.Select(e => e.SolicitacaoId).Distinct().ToList());

        // 4. Struct intermediário com dados da solicitação
        var dados = new Dictionary<Guid, (string Titulo, Guid SolicitanteId, DateTimeOffset DataCriacao, string StatusLabel, string? Link)>();

        async Task LoadAsync<T>(
            List<Guid> ids,
            Func<T, Guid> getId,
            Func<T, string> getTitulo,
            Func<T, Guid> getSolicitanteId,
            Func<T, DateTimeOffset> getData,
            Func<T, string> getStatus,
            Func<T, string?> getLink) where T : class
        {
            if (ids.Count == 0) return;
            var rows = await _db.Set<T>().AsNoTracking()
                .Where(x => ids.Contains(getId(x)))
                .ToListAsync(ct);
            foreach (var r in rows)
                dados[getId(r)] = (getTitulo(r), getSolicitanteId(r), getData(r), getStatus(r), getLink(r));
        }

        var vagaIds = new List<Guid>();
        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.RequisicaoPessoal, out var rp)) vagaIds.AddRange(rp);
        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.AumentoHeadcount, out var hc)) vagaIds.AddRange(hc);

        await LoadAsync<SolicitacaoVaga>(vagaIds.Distinct().ToList(),
            x => x.Id, x => x.Titulo, x => x.SolicitanteId, x => x.CreatedAtUtc,
            x => StatusLabel(x.Status), x => $"/rs/solicitacoes/{x.Id}");

        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.MovimentacaoPessoal, out var mv))
            await LoadAsync<SolicitacaoPromocao>(mv,
                x => x.Id, x => "Movimentação", x => x.SolicitanteId, x => x.CreatedAtUtc,
                x => StatusLabel(x.Status), x => $"/rs/solicitacoes-promocao/{x.Id}");

        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.Desligamento, out var ds))
            await LoadAsync<SolicitacaoDesligamento>(ds,
                x => x.Id, x => "Desligamento", x => x.SolicitanteId, x => x.CreatedAtUtc,
                x => StatusLabel(x.Status), x => $"/rs/solicitacoes-desligamento/{x.Id}");

        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.Ferias, out var fe))
            await LoadAsync<SolicitacaoFerias>(fe,
                x => x.Id, x => "Férias", x => x.SolicitanteId, x => x.CreatedAtUtc,
                x => StatusLabel(x.Status), x => $"/rs/solicitacoes-ferias/{x.Id}");

        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.Beneficio, out var bn))
            await LoadAsync<SolicitacaoBeneficio>(bn,
                x => x.Id, x => "Benefício", x => x.SolicitanteId, x => x.CreatedAtUtc,
                x => StatusLabel(x.Status), x => $"/rs/solicitacoes-beneficio/{x.Id}");

        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.Dependente, out var dp))
            await LoadAsync<SolicitacaoDependente>(dp,
                x => x.Id, x => "Dependente", x => x.SolicitanteId, x => x.CreatedAtUtc,
                x => StatusLabel(x.Status), x => $"/rs/solicitacoes-dependente/{x.Id}");

        if (idsPorFluxo.TryGetValue(TipoFluxoAprovacao.Endereco, out var en))
            await LoadAsync<SolicitacaoEndereco>(en,
                x => x.Id, x => "Endereço", x => x.SolicitanteId, x => x.CreatedAtUtc,
                x => StatusLabel(x.Status), x => $"/rs/solicitacoes-endereco/{x.Id}");

        // 5. Nomes dos solicitantes (batch)
        var solicitanteIds = dados.Values.Select(d => d.SolicitanteId).Distinct().ToList();
        var nomesPorFuncionario = await _db.Set<Funcionario>().AsNoTracking()
            .Where(f => solicitanteIds.Contains(f.Id))
            .Select(f => new { f.Id, f.Name })
            .ToDictionaryAsync(f => f.Id, f => f.Name, ct);

        // 6. Role names para filas
        var roleIds = etapaAtivaPorSolicitacao.Values
            .Where(e => e.RoleFilaId.HasValue).Select(e => e.RoleFilaId!.Value).Distinct().ToList();
        var roleNames = roleIds.Count > 0
            ? await _db.Set<ApplicationRole>().AsNoTracking()
                .Where(r => roleIds.Contains(r.Id))
                .ToDictionaryAsync(r => r.Id, r => r.Name ?? string.Empty, ct)
            : new Dictionary<Guid, string>();

        // 7. CanAssume: fila ainda não assumida + usuário no role
        var userRoleSet = userRoleIds.ToHashSet();

        // 8. Montar resposta
        var result = new List<PendingItemResponse>();
        foreach (var (solId, etapa) in etapaAtivaPorSolicitacao)
        {
            if (!dados.TryGetValue(solId, out var d)) continue;

            var isQueue = etapa.RoleFilaId.HasValue && etapa.AprovadorId == null && etapa.AssumedByUserId == null;
            string? pendenteCom = null;
            if (isQueue && roleNames.TryGetValue(etapa.RoleFilaId!.Value, out var rn))
                pendenteCom = rn;
            else if (etapa.AprovadorId.HasValue)
                nomesPorFuncionario.TryGetValue(etapa.AprovadorId.Value, out pendenteCom);

            var canAssume = isQueue && etapa.RoleFilaId.HasValue && userRoleSet.Contains(etapa.RoleFilaId.Value);

            result.Add(new PendingItemResponse(
                SolicitacaoId: solId,
                TipoFluxo: etapa.TipoFluxo.ToString(),
                TipoLabel: TipoFluxoLabel(etapa.TipoFluxo),
                Titulo: d.Titulo,
                SolicitanteNome: nomesPorFuncionario.GetValueOrDefault(d.SolicitanteId),
                DataCriacao: d.DataCriacao,
                StatusLabel: d.StatusLabel,
                EtapaLabel: etapa.Label,
                EtapaPendenteCom: pendenteCom,
                EtapaPendenteIsQueue: isQueue,
                EtapaPendenteAprovadorId: etapa.AprovadorId,
                EtapaPendenteAssumedByUserId: etapa.AssumedByUserId,
                EtapaPendenteCanAssume: canAssume,
                Link: d.Link
            ));
        }

        return Ok(result.OrderByDescending(r => r.DataCriacao).ToList());
    }

    private static string TipoFluxoLabel(TipoFluxoAprovacao t) => t switch
    {
        TipoFluxoAprovacao.RequisicaoPessoal   => "Requisição de Vaga",
        TipoFluxoAprovacao.AumentoHeadcount    => "Aumento de Headcount",
        TipoFluxoAprovacao.MovimentacaoPessoal => "Movimentação",
        TipoFluxoAprovacao.Desligamento        => "Desligamento",
        TipoFluxoAprovacao.Ferias              => "Férias",
        TipoFluxoAprovacao.Beneficio           => "Benefício",
        TipoFluxoAprovacao.Dependente          => "Dependente",
        TipoFluxoAprovacao.Endereco            => "Endereço",
        _                                      => t.ToString(),
    };

    private static string StatusLabel(SolicitacaoStatus s) => s switch
    {
        SolicitacaoStatus.PendenteAprovacao         => "Aguardando aprovação",
        SolicitacaoStatus.PendenteAprovacaoRh        => "Aguardando RH",
        SolicitacaoStatus.AguardandoDecisaoRH        => "Aguardando decisão RH",
        SolicitacaoStatus.PendenteAprovacaoAumentoHC => "Aguardando aprovação de HC",
        _                                            => s.ToString(),
    };

    public record PendentesCountResponse(int Count);
}
