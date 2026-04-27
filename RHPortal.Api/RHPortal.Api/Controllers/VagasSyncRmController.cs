using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
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
    private readonly IConfiguration _config;

    public VagasSyncRmController(AppDbContext db, ITenantContext tenantContext, IConfiguration config)
    {
        _db = db;
        _tenantContext = tenantContext;
        _config = config;
    }

    /// <summary>Threshold de ciclos consecutivos sem aparecer no payload do RM antes de gerar alerta. Default 3.</summary>
    private int ZumbiThresholdCiclos => _config.GetValue<int?>("RmSync:ZumbiThresholdCiclos") ?? 3;

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
        var runStartUtc = DateTimeOffset.UtcNow;

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

            // Aberta vem do payload (Frente C — worker manda explícito).
            // Fallback: legacy (controller infere de DataFechamento) para retrocompat.
            var aberta = item.Aberta
                ?? (!item.DataFechamento.HasValue || item.DataFechamento.Value.Date >= DateTime.UtcNow.Date);

            // VRSVAGAS.DATAABERTURA vem sem timezone do RM — gravamos como UTC para preservar a data.
            var dataAberturaRm = item.DataAbertura.HasValue
                ? new DateTimeOffset(DateTime.SpecifyKind(item.DataAbertura.Value, DateTimeKind.Utc), TimeSpan.Zero)
                : (DateTimeOffset?)null;

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
                existing.CodFuncaoRm = string.IsNullOrEmpty(item.CodFuncao?.Trim()) ? existing.CodFuncaoRm : item.CodFuncao!.Trim().Substring(0, Math.Min(20, item.CodFuncao.Trim().Length));
                existing.FuncaoNomeRm = string.IsNullOrEmpty(item.FuncaoNome?.Trim()) ? existing.FuncaoNomeRm : item.FuncaoNome!.Trim().Substring(0, Math.Min(160, item.FuncaoNome.Trim().Length));
                existing.DataAbertura = dataAberturaRm ?? existing.DataAbertura;
                existing.Status = aberta ? VagaStatus.Aberta : VagaStatus.Encerrada;
                existing.UpdatedAtUtc = now;
                // Frente C: vaga apareceu neste ciclo — zera contador de ausência.
                existing.CiclosAusenteRm = 0;
                existing.UltimoCicloRmObservadoUtc = runStartUtc;
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
                    CodFuncaoRm = string.IsNullOrEmpty(item.CodFuncao?.Trim()) ? null : item.CodFuncao!.Trim().Substring(0, Math.Min(20, item.CodFuncao.Trim().Length)),
                    FuncaoNomeRm = string.IsNullOrEmpty(item.FuncaoNome?.Trim()) ? null : item.FuncaoNome!.Trim().Substring(0, Math.Min(160, item.FuncaoNome.Trim().Length)),
                    DataAbertura = dataAberturaRm,
                    Status = aberta ? VagaStatus.Aberta : VagaStatus.Encerrada,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                    UltimoCicloRmObservadoUtc = runStartUtc,
                };
                _db.Vagas.Add(fresh);
                created++;
            }
        }

        await _db.SaveChangesAsync(ct);

        // Frente C — Detecção de zumbis (full sync only): vagas no Portal com Codigo (vinda do RM)
        // e Status != Encerrada que NÃO foram observadas neste ciclo são candidatas. Threshold default 3 ciclos.
        // Heurística "full sync": só detecta se o payload trouxe >= 1 item — assim modo incremental
        // (que pode trazer 0 itens em ciclos sem mudança) não dispara falso positivo.
        if (request.Items.Count > 0)
            await DetectarZumbisVagasAsync(tenantId, runStartUtc, ct);

        return Ok(new VagaSyncRmBulkResponse(created, updated, request.Items.Count, warnings));
    }

    /// <summary>
    /// Compara as vagas do Portal com origem RM (Codigo IS NOT NULL) com as que vieram neste ciclo.
    /// Para cada ausente: incrementa <c>CiclosAusenteRm</c>; ao cruzar threshold, gera/atualiza
    /// <c>RmSyncAlerta</c> tipo "VagaAusente". Quando a chave volta a aparecer, o alerta é resolvido
    /// automaticamente (Acao = "Auto-resolvido — chave reapareceu no RM").
    /// </summary>
    private async Task DetectarZumbisVagasAsync(string tenantId, DateTimeOffset runStartUtc, CancellationToken ct)
    {
        var threshold = ZumbiThresholdCiclos;

        // Vagas locais com origem RM que NÃO foram observadas neste ciclo (UltimoCicloRm < runStart).
        var ausentes = await _db.Vagas
            .Where(v => v.TenantId == tenantId
                && v.Codigo != null
                && v.Status != VagaStatus.Encerrada
                && (v.UltimoCicloRmObservadoUtc == null || v.UltimoCicloRmObservadoUtc < runStartUtc))
            .Select(v => new { v.Id, v.Codigo, v.CiclosAusenteRm })
            .ToListAsync(ct);

        if (ausentes.Count == 0)
        {
            // Resolução automática: se há alertas abertos cuja chave NÃO está mais ausente, resolve.
            await AutoResolverAlertasVagasAsync(tenantId, ct);
            return;
        }

        // Incrementa contador no banco em uma única passada.
        var ausentesIds = ausentes.Select(a => a.Id).ToList();
        await _db.Vagas
            .Where(v => ausentesIds.Contains(v.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.CiclosAusenteRm, v => v.CiclosAusenteRm + 1), ct);

        // Para os que cruzaram o threshold (nova contagem >= threshold), upsert do alerta.
        var cruzaramThreshold = ausentes
            .Where(a => a.CiclosAusenteRm + 1 >= threshold && !string.IsNullOrEmpty(a.Codigo))
            .ToList();

        if (cruzaramThreshold.Count > 0)
        {
            var chaves = cruzaramThreshold.Select(a => a.Codigo!).ToList();
            var existentes = await _db.Set<RmSyncAlerta>()
                .Where(x => x.TenantId == tenantId && x.Tipo == "VagaAusente" && chaves.Contains(x.ChaveRm))
                .ToListAsync(ct);

            var now = DateTimeOffset.UtcNow;
            foreach (var a in cruzaramThreshold)
            {
                var alerta = existentes.FirstOrDefault(x => x.ChaveRm == a.Codigo);
                if (alerta is null)
                {
                    _db.Set<RmSyncAlerta>().Add(new RmSyncAlerta
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Tipo = "VagaAusente",
                        EntidadeNome = "Vaga",
                        EntidadeId = a.Id,
                        ChaveRm = a.Codigo!,
                        DetectadoEmUtc = now,
                        CiclosAusente = a.CiclosAusenteRm + 1,
                    });
                }
                else if (alerta.ResolvidoEmUtc.HasValue)
                {
                    // Alerta foi resolvido antes; voltou a sumir — reabre.
                    alerta.ResolvidoEmUtc = null;
                    alerta.Acao = null;
                    alerta.DetectadoEmUtc = now;
                    alerta.CiclosAusente = a.CiclosAusenteRm + 1;
                }
                else
                {
                    alerta.CiclosAusente = a.CiclosAusenteRm + 1;
                }
            }
            await _db.SaveChangesAsync(ct);
        }

        await AutoResolverAlertasVagasAsync(tenantId, ct);
    }

    /// <summary>Resolve automaticamente alertas cuja chave reapareceu no RM (CiclosAusente=0).</summary>
    private async Task AutoResolverAlertasVagasAsync(string tenantId, CancellationToken ct)
    {
        var presentes = await _db.Vagas
            .Where(v => v.TenantId == tenantId && v.Codigo != null && v.CiclosAusenteRm == 0)
            .Select(v => v.Codigo!)
            .ToListAsync(ct);

        if (presentes.Count == 0) return;

        var paraResolver = await _db.Set<RmSyncAlerta>()
            .Where(x => x.TenantId == tenantId
                && x.Tipo == "VagaAusente"
                && x.ResolvidoEmUtc == null
                && presentes.Contains(x.ChaveRm))
            .ToListAsync(ct);

        if (paraResolver.Count == 0) return;

        var now = DateTimeOffset.UtcNow;
        foreach (var a in paraResolver)
        {
            a.ResolvidoEmUtc = now;
            a.Acao = "Auto-resolvido — chave reapareceu no RM";
        }
        await _db.SaveChangesAsync(ct);
    }
}
