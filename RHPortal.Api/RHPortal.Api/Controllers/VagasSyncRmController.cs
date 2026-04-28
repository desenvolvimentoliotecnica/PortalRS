using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Vagas;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint dedicado pro worker TOTVS RM (<c>PortalVagaSyncService</c>) sincronizar
/// vagas com origem rastreável (AumentoQuadro / Substituição_Desligamento /
/// Substituição_Promoção / Direta).
///
/// Resolve internamente:
///   - <c>CodSecao → CentroCustoId</c>
///   - <c>CodCargo → JobPositionId</c> (Code lookup)
///   - <c>CodFilial → UnitId</c>
///   - <c>IdHierarquiaDestinoRm → HierarquiaId</c>
///   - <c>IdReqDesligamentoRm → OrigemDesligamentoId</c> (lookup em <c>Desligamentos.IdReqRm</c>)
/// </summary>
[ApiController]
[Route("api/vagas/sync-rm")]
public sealed class VagasSyncRmController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public VagasSyncRmController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    [HttpPost("bulk")]
    [ProducesResponseType(typeof(VagaSyncRmBulkResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<VagaSyncRmBulkResponse>> BulkSync(
        [FromBody] VagaSyncRmBulkRequest request,
        CancellationToken ct)
    {
        var warnings = new List<string>();
        if (request?.Items is null || request.Items.Count == 0)
            return Ok(new VagaSyncRmBulkResponse(0, 0, 0, warnings));

        var tenantId = _tenantContext.TenantId;

        // Lookups
        var ccByCode = await _db.CentrosCusto.AsNoTracking().Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);
        var jobByCode = await _db.JobPositions.AsNoTracking().Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);
        var hierarquiaByIdRm = await _db.Hierarquias.AsNoTracking().Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.IdHierarquiaRm, x => x.Id, ct);
        var desligamentoByIdReq = await _db.Desligamentos.AsNoTracking().Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.IdReqRm, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);

        // Vagas existentes por Codigo (CodVaga RM)
        var codigos = request.Items.Select(i => i.CodVaga).Distinct().ToList();
        var byCodigo = await _db.Vagas
            .Where(v => v.TenantId == tenantId && v.Codigo != null && codigos.Contains(v.Codigo))
            .ToDictionaryAsync(v => v.Codigo!, v => v, ct);

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;

        foreach (var item in request.Items)
        {
            var codigo = item.CodVaga.Trim();
            Guid? centroCustoId = null;
            if (!string.IsNullOrWhiteSpace(item.CodSecao) && ccByCode.TryGetValue(item.CodSecao.Trim(), out var ccId))
                centroCustoId = ccId;

            Guid? jobPositionId = null;
            if (!string.IsNullOrWhiteSpace(item.CodCargo) && jobByCode.TryGetValue(item.CodCargo.Trim(), out var jpId))
                jobPositionId = jpId;

            // Vaga não tem UnitId direto — vínculo de filial fica via CentroCusto.

            Guid? hierarquiaId = null;
            if (item.IdHierarquiaDestinoRm.HasValue && hierarquiaByIdRm.TryGetValue(item.IdHierarquiaDestinoRm.Value, out var hId))
                hierarquiaId = hId;

            Guid? origemDesligamentoId = null;
            if (item.OrigemTipo == VagaOrigemTipo.SubstituicaoDesligamento
                && !string.IsNullOrWhiteSpace(item.IdReqDesligamentoRm)
                && desligamentoByIdReq.TryGetValue(item.IdReqDesligamentoRm.Trim(), out var dId))
                origemDesligamentoId = dId;

            var titulo = (item.Titulo ?? "").Trim();
            if (string.IsNullOrEmpty(titulo)) titulo = $"Vaga {codigo}";
            if (titulo.Length > 160) titulo = titulo.Substring(0, 160);

            var aberta = !item.DataFechamento.HasValue || item.DataFechamento.Value.Date >= DateTime.UtcNow.Date;

            if (byCodigo.TryGetValue(codigo, out var existing))
            {
                existing.Titulo = titulo;
                existing.QuantidadeVagas = item.Quantidade ?? existing.QuantidadeVagas;
                existing.DescricaoInterna = string.IsNullOrWhiteSpace(item.Descricao) ? existing.DescricaoInterna : item.Descricao;
                existing.CentroCustoId = centroCustoId ?? existing.CentroCustoId;
                existing.JobPositionId = jobPositionId ?? existing.JobPositionId;
                existing.HierarquiaId = hierarquiaId ?? existing.HierarquiaId;
                existing.OrigemTipo = item.OrigemTipo;
                existing.OrigemDesligamentoId = origemDesligamentoId ?? existing.OrigemDesligamentoId;
                existing.IdReqRmOrigem = item.IdReqRmOrigem ?? existing.IdReqRmOrigem;
                existing.Status = aberta ? VagaStatus.Aberta : VagaStatus.Encerrada;
                existing.UpdatedAtUtc = now;
                updated++;
            }
            else
            {
                var fresh = new Vaga
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Codigo = codigo.Length > 40 ? codigo.Substring(0, 40) : codigo,
                    Titulo = titulo,
                    QuantidadeVagas = item.Quantidade ?? 1,
                    HeadcountAutorizado = item.Quantidade ?? 1,
                    DescricaoInterna = item.Descricao,
                    CentroCustoId = centroCustoId,
                    JobPositionId = jobPositionId,
                    HierarquiaId = hierarquiaId,
                    OrigemTipo = item.OrigemTipo,
                    OrigemDesligamentoId = origemDesligamentoId,
                    IdReqRmOrigem = item.IdReqRmOrigem,
                    Status = aberta ? VagaStatus.Aberta : VagaStatus.Encerrada,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                };
                _db.Vagas.Add(fresh);
                created++;
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new VagaSyncRmBulkResponse(created, updated, request.Items.Count, warnings));
    }
}
