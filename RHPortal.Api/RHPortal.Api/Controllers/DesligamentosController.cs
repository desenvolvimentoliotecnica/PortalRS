using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Desligamentos;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Pipeline de desligamentos sincronizado do TOTVS RM (<c>VREQDESLIGAMENTO</c>).
///
/// Inclui o flag <c>GerouSubstituicao</c> (= <c>CRIASUBSTITUICAO</c> do RM).
/// Quando true, a vaga gerada referencia o desligamento via <c>Vaga.OrigemDesligamentoId</c>.
///
/// Endpoints:
///   - <c>GET /api/desligamentos</c> — lista paginada com filtros
///   - <c>GET /api/desligamentos/{id}</c> — detalhe + vaga gerada (lookup reverso)
///   - <c>POST /api/desligamentos/bulk</c> — bulk upsert (worker)
/// </summary>
[ApiController]
[Route("api/desligamentos")]
public sealed class DesligamentosController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public DesligamentosController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<DesligamentoListItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DesligamentoListItem>>> List(
        CancellationToken ct,
        [FromQuery] int? codStatus = null,
        [FromQuery] bool? gerouSubstituicao = null,
        [FromQuery] DateTime? dataInicio = null,
        [FromQuery] DateTime? dataFim = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 200)
    {
        var query = _db.Desligamentos.AsNoTracking();

        if (codStatus.HasValue) query = query.Where(d => d.CodStatus == codStatus.Value);
        if (gerouSubstituicao.HasValue) query = query.Where(d => d.GerouSubstituicao == gerouSubstituicao.Value);
        if (dataInicio.HasValue) query = query.Where(d => d.DataAbertura >= dataInicio.Value);
        if (dataFim.HasValue) query = query.Where(d => d.DataAbertura <= dataFim.Value);

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(d => d.DataAbertura)
            .Skip(skip)
            .Take(take)
            .Select(d => new DesligamentoListItem(
                d.Id,
                d.IdReqRm,
                d.ChapaRm,
                d.FuncionarioId,
                d.Funcionario != null ? d.Funcionario.Name : null,
                d.MotivoRescisaoDescricao,
                d.TipoRescisaoDescricao,
                d.GerouSubstituicao,
                d.DataAbertura,
                d.DataConclusao,
                d.CodStatus,
                StatusToString(d.CodStatus)))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(rows);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DesligamentoDetalheResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DesligamentoDetalheResponse>> GetById(Guid id, CancellationToken ct)
    {
        var d = await _db.Desligamentos
            .AsNoTracking()
            .Include(x => x.Funcionario)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();

        // Lookup reverso: vaga que tem OrigemDesligamentoId apontando pra este desligamento.
        // Esse campo só existe a partir do Bloco 6 (refactor de Vaga). Por enquanto, deixa null.
        Guid? vagaId = null;
        string? vagaTitulo = null;
        // TODO Bloco 6: var vaga = await _db.Vagas.AsNoTracking().FirstOrDefaultAsync(v => v.OrigemDesligamentoId == id, ct);

        return Ok(new DesligamentoDetalheResponse(
            d.Id,
            d.IdReqRm,
            d.ChapaRm,
            d.FuncionarioId,
            d.Funcionario?.Name,
            d.CodMotivoRescisao,
            d.MotivoRescisaoDescricao,
            d.CodTipoRescisao,
            d.TipoRescisaoDescricao,
            d.GerouSubstituicao,
            d.DataAbertura,
            d.DataPrevista,
            d.DataConclusao,
            d.DataCancelamento,
            d.CodStatus,
            StatusToString(d.CodStatus),
            d.Justificativa,
            d.NumDiasAviso,
            vagaId,
            vagaTitulo,
            d.CreatedAtUtc,
            d.UpdatedAtUtc));
    }

    /// <summary>Bulk upsert idempotente por <c>IdReqRm</c>. Resolve <c>FuncionarioId</c> via <c>MatriculaRm</c>.</summary>
    [HttpPost("bulk")]
    [ProducesResponseType(typeof(DesligamentoBulkUpsertResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DesligamentoBulkUpsertResponse>> BulkUpsert(
        [FromBody] DesligamentoBulkUpsertRequest request,
        CancellationToken ct)
    {
        if (request?.Items is null || request.Items.Count == 0)
            return Ok(new DesligamentoBulkUpsertResponse(0, 0, 0));

        var tenantId = _tenantContext.TenantId;

        // Lookup CHAPA → FuncionarioId (atualiza dinamicamente conforme funcionários são sincronizados)
        var chapas = request.Items.Select(x => x.ChapaRm).Distinct().ToList();
        var funcionarioByChapa = await _db.Funcionarios
            .Where(f => f.TenantId == tenantId && f.MatriculaRm != null && chapas.Contains(f.MatriculaRm))
            .ToDictionaryAsync(f => f.MatriculaRm!, f => f.Id, ct);

        // Existing por IdReqRm
        var idsRm = request.Items.Select(x => x.IdReqRm).Distinct().ToList();
        var byIdReq = await _db.Desligamentos
            .Where(d => d.TenantId == tenantId && idsRm.Contains(d.IdReqRm))
            .ToDictionaryAsync(d => d.IdReqRm, ct);

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;

        foreach (var item in request.Items)
        {
            funcionarioByChapa.TryGetValue(item.ChapaRm, out var funcId);

            if (byIdReq.TryGetValue(item.IdReqRm, out var existing))
            {
                existing.ChapaRm = item.ChapaRm;
                existing.FuncionarioId = funcId == Guid.Empty ? null : funcId;
                existing.CodMotivoRescisao = item.CodMotivoRescisao;
                existing.MotivoRescisaoDescricao = item.MotivoRescisaoDescricao;
                existing.CodTipoRescisao = item.CodTipoRescisao;
                existing.TipoRescisaoDescricao = item.TipoRescisaoDescricao;
                existing.GerouSubstituicao = item.GerouSubstituicao;
                existing.DataAbertura = item.DataAbertura;
                existing.DataPrevista = item.DataPrevista;
                existing.DataConclusao = item.DataConclusao;
                existing.DataCancelamento = item.DataCancelamento;
                existing.CodStatus = item.CodStatus;
                existing.Justificativa = item.Justificativa;
                existing.NumDiasAviso = item.NumDiasAviso;
                existing.UpdatedAtUtc = now;
                updated++;
            }
            else
            {
                _db.Desligamentos.Add(new Desligamento
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    IdReqRm = item.IdReqRm,
                    ChapaRm = item.ChapaRm,
                    FuncionarioId = funcId == Guid.Empty ? null : funcId,
                    CodMotivoRescisao = item.CodMotivoRescisao,
                    MotivoRescisaoDescricao = item.MotivoRescisaoDescricao,
                    CodTipoRescisao = item.CodTipoRescisao,
                    TipoRescisaoDescricao = item.TipoRescisaoDescricao,
                    GerouSubstituicao = item.GerouSubstituicao,
                    DataAbertura = item.DataAbertura,
                    DataPrevista = item.DataPrevista,
                    DataConclusao = item.DataConclusao,
                    DataCancelamento = item.DataCancelamento,
                    CodStatus = item.CodStatus,
                    Justificativa = item.Justificativa,
                    NumDiasAviso = item.NumDiasAviso,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                created++;
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new DesligamentoBulkUpsertResponse(created, updated, request.Items.Count));
    }

    private static string StatusToString(int codStatus) => codStatus switch
    {
        1 => "Aberta",
        2 => "Em análise",
        3 => "Aprovada",
        4 => "Concluída",
        5 => "Em andamento",
        6 => "Cancelada",
        7 => "Rejeitada",
        _ => $"Status {codStatus}",
    };
}
