using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Histórico de movimentações de funcionário (LUC-122). Consolidado de:
///   - VREQTRANSFPROMOCAO (promoção/transferência)
///   - VREQAUMENTOQUADRO (quando funcionário é requisitante)
///   - VREQDESLIGAMENTO (rescisão)
/// </summary>
[ApiController]
[Route("api/funcionarios")]
public sealed class FuncionarioMovimentacoesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public FuncionarioMovimentacoesController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    /// <summary>Histórico de movimentações de um funcionário.</summary>
    [HttpGet("{id:guid}/movimentacoes")]
    [ProducesResponseType(typeof(List<FuncionarioMovimentacaoListItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<FuncionarioMovimentacaoListItem>>> ListByFuncionario(Guid id, CancellationToken ct)
    {
        var rows = await _db.FuncionarioMovimentacoes
            .AsNoTracking()
            .Where(m => m.FuncionarioId == id)
            .OrderByDescending(m => m.DataAbertura)
            .Select(m => new FuncionarioMovimentacaoListItem(
                m.Id, m.FuncionarioId, m.ChapaRm, m.IdReqRm, m.TipoMovimentacao, m.TipoDescricao,
                m.DataAbertura, m.DataConclusao, m.CodStatus, m.StatusDescricao,
                m.CodFuncaoOrigem, m.CodFuncaoDestino, m.CodSecaoOrigem, m.CodSecaoDestino,
                m.IdHierarquiaOrigemRm, m.IdHierarquiaDestinoRm,
                m.SalarioOrigem, m.SalarioDestino, m.GestorHistoricoChapaRm, m.GestorHistoricoNome,
                m.GerouSubstituicao))
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>Lista todas as movimentações (uso na tela "Minhas Pendências"). Filtros por status.</summary>
    [HttpGet("movimentacoes")]
    [ProducesResponseType(typeof(List<FuncionarioMovimentacaoComNomeListItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<FuncionarioMovimentacaoComNomeListItem>>> ListAll(
        [FromQuery] int[]? codStatus,
        [FromQuery] int pageSize = 200,
        CancellationToken ct = default)
    {
        var q = _db.FuncionarioMovimentacoes.AsNoTracking().AsQueryable();
        if (codStatus is not null && codStatus.Length > 0)
            q = q.Where(m => codStatus.Contains(m.CodStatus));

        var rows = await q
            .OrderByDescending(m => m.DataAbertura)
            .Take(pageSize)
            .Select(m => new FuncionarioMovimentacaoComNomeListItem(
                m.Id, m.FuncionarioId,
                m.Funcionario != null ? m.Funcionario.Name : null,
                m.ChapaRm, m.IdReqRm, m.TipoMovimentacao, m.TipoDescricao,
                m.DataAbertura, m.DataConclusao, m.CodStatus, m.StatusDescricao,
                m.CodFuncaoOrigem, m.CodFuncaoDestino,
                m.SalarioOrigem, m.SalarioDestino, m.GestorHistoricoChapaRm, m.GestorHistoricoNome))
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>Bulk upsert idempotente — consumido pelo worker (PortalFuncionarioMovimentacaoSyncService).</summary>
    [HttpPost("movimentacoes/bulk")]
    [ProducesResponseType(typeof(FuncionarioMovimentacaoBulkResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FuncionarioMovimentacaoBulkResponse>> BulkUpsert(
        [FromBody] FuncionarioMovimentacaoBulkRequest request,
        CancellationToken ct)
    {
        if (request?.Items is null || request.Items.Count == 0)
            return Ok(new FuncionarioMovimentacaoBulkResponse(0, 0, 0));

        var tenantId = _tenantContext.TenantId;

        // Lookup funcionários por CHAPA
        var chapas = request.Items.Select(i => i.ChapaRm).Distinct().ToList();
        var funcByChapaRaw = await _db.Funcionarios
            .Where(f => f.TenantId == tenantId && f.MatriculaRm != null && chapas.Contains(f.MatriculaRm))
            .ToListAsync(ct);
        var funcByChapa = funcByChapaRaw
            .GroupBy(f => f.MatriculaRm!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Id);

        // Lookup hierarquias por IdHierarquiaRm
        var hierarquiaIds = request.Items.SelectMany(i => new[] { i.IdHierarquiaOrigemRm, i.IdHierarquiaDestinoRm })
            .Where(h => h.HasValue).Select(h => h!.Value).Distinct().ToList();
        var hierByIdRm = await _db.Hierarquias
            .Where(h => h.TenantId == tenantId && hierarquiaIds.Contains(h.IdHierarquiaRm))
            .ToDictionaryAsync(h => h.IdHierarquiaRm, h => h.Id, ct);

        // Movimentações existentes
        var idReqs = request.Items.Select(i => i.IdReqRm).Distinct().ToList();
        var byIdReq = await _db.FuncionarioMovimentacoes
            .Where(m => m.TenantId == tenantId && idReqs.Contains(m.IdReqRm))
            .ToDictionaryAsync(m => m.IdReqRm, m => m, ct);

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;

        foreach (var item in request.Items)
        {
            funcByChapa.TryGetValue(item.ChapaRm.Trim(), out var funcionarioId);
            Guid? hierOrigemId = item.IdHierarquiaOrigemRm.HasValue && hierByIdRm.TryGetValue(item.IdHierarquiaOrigemRm.Value, out var ho) ? ho : null;
            Guid? hierDestinoId = item.IdHierarquiaDestinoRm.HasValue && hierByIdRm.TryGetValue(item.IdHierarquiaDestinoRm.Value, out var hd) ? hd : null;

            if (byIdReq.TryGetValue(item.IdReqRm, out var existing))
            {
                existing.FuncionarioId = funcionarioId == Guid.Empty ? null : funcionarioId;
                existing.ChapaRm = item.ChapaRm;
                existing.TipoMovimentacao = item.TipoMovimentacao;
                existing.TipoDescricao = item.TipoDescricao;
                existing.DataAbertura = item.DataAbertura;
                existing.DataConclusao = item.DataConclusao;
                existing.DataCancelamento = item.DataCancelamento;
                existing.CodStatus = item.CodStatus;
                existing.StatusDescricao = item.StatusDescricao;
                existing.CodFuncaoOrigem = item.CodFuncaoOrigem;
                existing.CodFuncaoDestino = item.CodFuncaoDestino;
                existing.CodSecaoOrigem = item.CodSecaoOrigem;
                existing.CodSecaoDestino = item.CodSecaoDestino;
                existing.HierarquiaOrigemId = hierOrigemId;
                existing.HierarquiaDestinoId = hierDestinoId;
                existing.IdHierarquiaOrigemRm = item.IdHierarquiaOrigemRm;
                existing.IdHierarquiaDestinoRm = item.IdHierarquiaDestinoRm;
                existing.SalarioOrigem = item.SalarioOrigem;
                existing.SalarioDestino = item.SalarioDestino;
                existing.Justificativa = item.Justificativa;
                existing.GestorHistoricoChapaRm = item.GestorHistoricoChapaRm;
                existing.GestorHistoricoNome = item.GestorHistoricoNome;
                existing.GerouSubstituicao = item.GerouSubstituicao;
                existing.UpdatedAtUtc = now;
                updated++;
            }
            else
            {
                _db.FuncionarioMovimentacoes.Add(new FuncionarioMovimentacao
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    FuncionarioId = funcionarioId == Guid.Empty ? null : funcionarioId,
                    ChapaRm = item.ChapaRm,
                    IdReqRm = item.IdReqRm,
                    TipoMovimentacao = item.TipoMovimentacao,
                    TipoDescricao = item.TipoDescricao,
                    DataAbertura = item.DataAbertura,
                    DataConclusao = item.DataConclusao,
                    DataCancelamento = item.DataCancelamento,
                    CodStatus = item.CodStatus,
                    StatusDescricao = item.StatusDescricao,
                    CodFuncaoOrigem = item.CodFuncaoOrigem,
                    CodFuncaoDestino = item.CodFuncaoDestino,
                    CodSecaoOrigem = item.CodSecaoOrigem,
                    CodSecaoDestino = item.CodSecaoDestino,
                    HierarquiaOrigemId = hierOrigemId,
                    HierarquiaDestinoId = hierDestinoId,
                    IdHierarquiaOrigemRm = item.IdHierarquiaOrigemRm,
                    IdHierarquiaDestinoRm = item.IdHierarquiaDestinoRm,
                    SalarioOrigem = item.SalarioOrigem,
                    SalarioDestino = item.SalarioDestino,
                    Justificativa = item.Justificativa,
                    GestorHistoricoChapaRm = item.GestorHistoricoChapaRm,
                    GestorHistoricoNome = item.GestorHistoricoNome,
                    GerouSubstituicao = item.GerouSubstituicao,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                created++;
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new FuncionarioMovimentacaoBulkResponse(created, updated, request.Items.Count));
    }
}
