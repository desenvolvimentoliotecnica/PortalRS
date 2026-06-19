using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint dedicado pro worker TOTVS RM (<c>PortalVagaSyncService</c>) sincronizar
/// vagas com origem rastreável (AumentoQuadro / Substituição_Desligamento /
/// Substituição_Promoção / Direta).
///
/// Refactor 2026-04-27: chave de upsert preferencial é <c>IdReqRm</c> (= IDREQ da
/// VREQ-mãe, gravado em <c>Vaga.IdReqRmOrigem</c>). Itens "Direta" (sem IdReqRm)
/// continuam usando <c>CodVaga</c> (gravado em <c>Vaga.Codigo</c>). Match secundário
/// por CodVaga é tentado quando IdReqRm não casa (reaproveita vagas pré-refactor).
///
/// Status agora vem explícito do worker (<c>item.Status</c>), mapeado a partir do
/// CODSTATUS da req-mãe. Compatibilidade: se Status=NaoInformado, ainda respeita
/// o flag legado <c>aberta</c>.
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
        var funcionarioByChapa = await BuildFuncionarioByChapaLookupAsync(tenantId, request.Items, ct);

        // Vagas existentes por chave preferencial (IdReqRm) e secundária (Codigo).
        // Pós-refactor 2026-04-27: chave primária é IdReqRm; Codigo só é usado para itens
        // Direta (sem req-mãe) e como fallback pra reaproveitar vagas pré-refactor.
        var idReqs = request.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.IdReqRm))
            .Select(i => i.IdReqRm!.Trim())
            .Distinct()
            .ToList();
        var codigos = request.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.CodVaga))
            .Select(i => i.CodVaga!.Trim())
            .Distinct()
            .ToList();

        // IdReqRmOrigem é um AGRUPADOR (não chave única) — uma req com NUMVAGAS>1 gera N
        // VRSVAGAS distintas, legitimamente com mesmo IDREQ. Lookup retorna lista.
        var byIdReq = idReqs.Count == 0
            ? new Dictionary<string, List<Vaga>>()
            : (await _db.Vagas
                .Where(v => v.TenantId == tenantId && v.IdReqRmOrigem != null && idReqs.Contains(v.IdReqRmOrigem))
                .ToListAsync(ct))
                .GroupBy(v => v.IdReqRmOrigem!)
                .ToDictionary(g => g.Key, g => g.ToList());

        // Codigo também pode estar duplicado em vagas pré-refactor (heurística antiga
        // atribuiu IdReqRmOrigem distintos pra mesmas CODVAGAs). Lookup retorna lista.
        var byCodigo = codigos.Count == 0
            ? new Dictionary<string, List<Vaga>>()
            : (await _db.Vagas
                .Where(v => v.TenantId == tenantId && v.Codigo != null && codigos.Contains(v.Codigo))
                .ToListAsync(ct))
                .GroupBy(v => v.Codigo!)
                .ToDictionary(g => g.Key, g => g.ToList());

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;

        foreach (var item in request.Items)
        {
            // Validação mínima: precisa de pelo menos uma chave
            var idReq = item.IdReqRm?.Trim();
            var codVaga = item.CodVaga?.Trim();
            if (string.IsNullOrEmpty(idReq) && string.IsNullOrEmpty(codVaga))
            {
                warnings.Add($"Item sem IdReqRm e sem CodVaga ignorado (titulo='{item.Titulo}').");
                continue;
            }

            Guid? centroCustoId = null;
            if (!string.IsNullOrWhiteSpace(item.CodSecao) && ccByCode.TryGetValue(item.CodSecao.Trim(), out var ccId))
                centroCustoId = ccId;

            Guid? jobPositionId = null;
            if (!string.IsNullOrWhiteSpace(item.CodCargo) && jobByCode.TryGetValue(item.CodCargo.Trim(), out var jpId))
                jobPositionId = jpId;

            Guid? hierarquiaId = null;
            if (item.IdHierarquiaDestinoRm.HasValue && hierarquiaByIdRm.TryGetValue(item.IdHierarquiaDestinoRm.Value, out var hId))
                hierarquiaId = hId;

            Guid? origemDesligamentoId = null;
            if (item.OrigemTipo == VagaOrigemTipo.SubstituicaoDesligamento
                && !string.IsNullOrWhiteSpace(item.IdReqDesligamentoRm)
                && desligamentoByIdReq.TryGetValue(item.IdReqDesligamentoRm.Trim(), out var dId))
                origemDesligamentoId = dId;

            var gestorRequisitanteFuncionarioId = ResolveGestorRequisitanteFuncionarioId(item, funcionarioByChapa);

            var titulo = RmFuncaoTituloBuilder.Build(item.CodFuncao, item.FuncaoNome, item.FuncaoDescricao);

            // Status: agora vem explícito do worker (mapeado de CODSTATUS RM).
            // Fallback retrocompat: se vier NaoInformado, infere do flag legado `aberta` ou de DataFechamento.
            var statusItem = item.Status;
            if (statusItem == VagaStatus.NaoInformado)
            {
                var aberta = item.Aberta
                    ?? (!item.DataFechamento.HasValue || item.DataFechamento.Value.Date >= DateTime.UtcNow.Date);
                statusItem = aberta ? VagaStatus.Aberta : VagaStatus.Encerrada;
            }

            // Datas vêm sem timezone do RM — gravamos como UTC.
            var dataAberturaRm = ToUtcOffsetOrNull(item.DataAbertura);

            // Match preferencial: IdReqRm → todas as vagas com aquele IdReqRmOrigem (pode haver
            // múltiplas se a req tem NUMVAGAS>1). Atualiza todas com o novo status/dados.
            var existingMatches = new List<Vaga>();
            if (!string.IsNullOrEmpty(idReq) && byIdReq.TryGetValue(idReq, out var matches))
                existingMatches.AddRange(matches);

            // Match secundário por CodVaga (mesmo CODVAGA pode estar em vagas pré-refactor com
            // IdReqRmOrigem diferentes). Aceita: sem IdReqRmOrigem ou batendo com idReq atual.
            if (existingMatches.Count == 0 && !string.IsNullOrEmpty(codVaga) && byCodigo.TryGetValue(codVaga, out var v2List))
            {
                foreach (var v2 in v2List)
                {
                    if (string.IsNullOrEmpty(v2.IdReqRmOrigem) || v2.IdReqRmOrigem == idReq)
                        existingMatches.Add(v2);
                }
            }

            var codFuncaoTrim = TruncateNullSafe(item.CodFuncao, 20);
            var funcaoNomeTrim = TruncateNullSafe(item.FuncaoNome, 160);

            if (existingMatches.Count > 0)
            {
                foreach (var existing in existingMatches)
                {
                    existing.Titulo = titulo;
                    existing.QuantidadeVagas = item.Quantidade ?? existing.QuantidadeVagas;
                    existing.DescricaoInterna = string.IsNullOrWhiteSpace(item.Descricao) ? existing.DescricaoInterna : item.Descricao;
                    existing.CentroCustoId = centroCustoId ?? existing.CentroCustoId;
                    existing.JobPositionId = jobPositionId ?? existing.JobPositionId;
                    existing.HierarquiaId = hierarquiaId ?? existing.HierarquiaId;
                    existing.OrigemTipo = item.OrigemTipo;
                    existing.OrigemDesligamentoId = origemDesligamentoId ?? existing.OrigemDesligamentoId;
                    existing.IdReqRmOrigem = idReq ?? existing.IdReqRmOrigem;
                    // Codigo só é sobrescrito se codVaga vier no payload E a vaga existente
                    // ainda não tem Codigo (preserva o vínculo da heurística antiga).
                    if (!string.IsNullOrEmpty(codVaga) && string.IsNullOrEmpty(existing.Codigo))
                        existing.Codigo = TruncateNullSafe(codVaga, 40);
                    existing.CodFuncaoRm = codFuncaoTrim ?? existing.CodFuncaoRm;
                    existing.FuncaoNomeRm = funcaoNomeTrim ?? existing.FuncaoNomeRm;
                    existing.DataAbertura = dataAberturaRm ?? existing.DataAbertura;
                    existing.Status = statusItem;
                    VagaRmSyncApplicator.ApplyImportFields(existing, item);
                    if (gestorRequisitanteFuncionarioId.HasValue)
                        existing.GestorRequisitanteFuncionarioId = gestorRequisitanteFuncionarioId.Value;
                    existing.UpdatedAtUtc = now;
                    existing.CiclosAusenteRm = 0;
                    existing.UltimoCicloRmObservadoUtc = runStartUtc;
                    updated++;
                }
            }
            else
            {
                var fresh = new Vaga
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Codigo = TruncateNullSafe(codVaga, 40),
                    Titulo = titulo,
                    QuantidadeVagas = item.Quantidade ?? 1,
                    HeadcountAutorizado = item.Quantidade ?? 1,
                    DescricaoInterna = item.Descricao,
                    CentroCustoId = centroCustoId,
                    JobPositionId = jobPositionId,
                    HierarquiaId = hierarquiaId,
                    OrigemTipo = item.OrigemTipo,
                    OrigemDesligamentoId = origemDesligamentoId,
                    IdReqRmOrigem = idReq,
                    CodFuncaoRm = codFuncaoTrim,
                    FuncaoNomeRm = funcaoNomeTrim,
                    DataAbertura = dataAberturaRm,
                    Status = statusItem,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                    UltimoCicloRmObservadoUtc = runStartUtc,
                };
                VagaRmSyncApplicator.ApplyImportFields(fresh, item);
                fresh.GestorRequisitanteFuncionarioId = gestorRequisitanteFuncionarioId;
                _db.Vagas.Add(fresh);
                created++;
            }
        }

        var vagasRmSemTipoContratacao = await _db.Vagas
            .Where(v => v.TenantId == tenantId
                && v.TipoContratacao == null
                && (v.IdReqRmOrigem != null || v.Codigo != null))
            .ToListAsync(ct);

        foreach (var vagaRm in vagasRmSemTipoContratacao)
        {
            if (VagaRmSyncApplicator.ApplyCltDefaultForImportedRmVaga(vagaRm))
                vagaRm.UpdatedAtUtc = now;
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
    /// Compara as vagas do Portal com origem RM (IdReqRmOrigem OU Codigo preenchido) com
    /// as que vieram neste ciclo. Para cada ausente em status vivo (Aberta/Pausada),
    /// incrementa <c>CiclosAusenteRm</c>; ao cruzar threshold, gera/atualiza
    /// <c>RmSyncAlerta</c> tipo "VagaAusente". Quando a chave volta a aparecer, o alerta é
    /// resolvido automaticamente.
    ///
    /// Nota pós-refactor 2026-04-27: a chave do alerta agora prioriza IdReqRmOrigem
    /// (mais estável que Codigo). Vagas com status já Encerrada/Cancelada/Preenchida
    /// não são monitoradas porque já estão "fechadas" no Portal.
    /// </summary>
    private async Task DetectarZumbisVagasAsync(string tenantId, DateTimeOffset runStartUtc, CancellationToken ct)
    {
        var threshold = ZumbiThresholdCiclos;

        var ausentes = await _db.Vagas
            .Where(v => v.TenantId == tenantId
                && (v.IdReqRmOrigem != null || v.Codigo != null)
                && v.Status != VagaStatus.Encerrada
                && v.Status != VagaStatus.Cancelada
                && v.Status != VagaStatus.Preenchida
                && (v.UltimoCicloRmObservadoUtc == null || v.UltimoCicloRmObservadoUtc < runStartUtc))
            .Select(v => new { v.Id, v.Codigo, v.IdReqRmOrigem, v.CiclosAusenteRm })
            .ToListAsync(ct);

        if (ausentes.Count == 0)
        {
            await AutoResolverAlertasVagasAsync(tenantId, ct);
            return;
        }

        var ausentesIds = ausentes.Select(a => a.Id).ToList();
        await _db.Vagas
            .Where(v => ausentesIds.Contains(v.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.CiclosAusenteRm, v => v.CiclosAusenteRm + 1), ct);

        var cruzaramThreshold = ausentes
            .Where(a => a.CiclosAusenteRm + 1 >= threshold)
            .Select(a => new { a.Id, ChaveRm = a.IdReqRmOrigem ?? a.Codigo!, NovaContagem = a.CiclosAusenteRm + 1 })
            .Where(a => !string.IsNullOrEmpty(a.ChaveRm))
            .ToList();

        if (cruzaramThreshold.Count > 0)
        {
            var chaves = cruzaramThreshold.Select(a => a.ChaveRm).ToList();
            var existentes = await _db.Set<RmSyncAlerta>()
                .Where(x => x.TenantId == tenantId && x.Tipo == "VagaAusente" && chaves.Contains(x.ChaveRm))
                .ToListAsync(ct);

            var now = DateTimeOffset.UtcNow;
            foreach (var a in cruzaramThreshold)
            {
                var alerta = existentes.FirstOrDefault(x => x.ChaveRm == a.ChaveRm);
                if (alerta is null)
                {
                    _db.Set<RmSyncAlerta>().Add(new RmSyncAlerta
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Tipo = "VagaAusente",
                        EntidadeNome = "Vaga",
                        EntidadeId = a.Id,
                        ChaveRm = a.ChaveRm,
                        DetectadoEmUtc = now,
                        CiclosAusente = a.NovaContagem,
                    });
                }
                else if (alerta.ResolvidoEmUtc.HasValue)
                {
                    alerta.ResolvidoEmUtc = null;
                    alerta.Acao = null;
                    alerta.DetectadoEmUtc = now;
                    alerta.CiclosAusente = a.NovaContagem;
                }
                else
                {
                    alerta.CiclosAusente = a.NovaContagem;
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
            .Where(v => v.TenantId == tenantId
                && (v.IdReqRmOrigem != null || v.Codigo != null)
                && v.CiclosAusenteRm == 0)
            .Select(v => new { v.IdReqRmOrigem, v.Codigo })
            .ToListAsync(ct);

        if (presentes.Count == 0) return;

        var chavesPresentes = presentes
            .Select(p => p.IdReqRmOrigem ?? p.Codigo!)
            .Where(c => !string.IsNullOrEmpty(c))
            .Distinct()
            .ToList();

        if (chavesPresentes.Count == 0) return;

        var paraResolver = await _db.Set<RmSyncAlerta>()
            .Where(x => x.TenantId == tenantId
                && x.Tipo == "VagaAusente"
                && x.ResolvidoEmUtc == null
                && chavesPresentes.Contains(x.ChaveRm))
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

    private static DateTimeOffset? ToUtcOffsetOrNull(DateTime? dt) =>
        dt.HasValue ? new DateTimeOffset(DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc), TimeSpan.Zero) : null;

    private async Task<Dictionary<string, Guid>> BuildFuncionarioByChapaLookupAsync(
        string tenantId,
        IEnumerable<VagaSyncRmItem> items,
        CancellationToken ct)
    {
        var chapas = items
            .Select(i => NormalizeRmChapa(i.GestorRequisitanteChapa))
            .Where(c => !string.IsNullOrEmpty(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (chapas.Count == 0)
            return new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);

        var funcionarios = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.MatriculaRm != null)
            .Select(f => new { f.Id, f.MatriculaRm })
            .ToListAsync(ct);

        return funcionarios
            .Select(f => new { f.Id, Chapa = NormalizeRmChapa(f.MatriculaRm) })
            .Where(f => f.Chapa is not null && chapas.Contains(f.Chapa, StringComparer.OrdinalIgnoreCase))
            .GroupBy(f => f.Chapa!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);
    }

    private static Guid? ResolveGestorRequisitanteFuncionarioId(
        VagaSyncRmItem item,
        IReadOnlyDictionary<string, Guid> funcionarioByChapa)
    {
        var chapa = NormalizeRmChapa(item.GestorRequisitanteChapa);
        if (chapa is null)
            return null;

        return funcionarioByChapa.TryGetValue(chapa, out var funcionarioId)
            ? funcionarioId
            : null;
    }

    private static string? NormalizeRmChapa(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    private static string? TruncateNullSafe(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value)) return null;
        var trimmed = value.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length > maxLength ? trimmed.Substring(0, maxLength) : trimmed;
    }
}
