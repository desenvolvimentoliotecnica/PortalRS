using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public sealed class SolicitacaoVagaRmCodStatusSyncService : ISolicitacaoVagaRmCodStatusSyncService
{
    public const string RmSyncEntidadeNome = "SolicitacaoVagaCodStatus";

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IRmRequisicoesReadService _rmRead;
    private readonly IRmSyncRunService _rmSyncRuns;
    private readonly StatusHistoricoService _historico;
    private readonly RmConnectionOptions _rmOpts;
    private readonly ILogger<SolicitacaoVagaRmCodStatusSyncService> _logger;

    public SolicitacaoVagaRmCodStatusSyncService(
        AppDbContext db,
        ITenantContext tenantContext,
        IRmRequisicoesReadService rmRead,
        IRmSyncRunService rmSyncRuns,
        StatusHistoricoService historico,
        IOptions<RmConnectionOptions> rmOpts,
        ILogger<SolicitacaoVagaRmCodStatusSyncService> logger)
    {
        _db = db;
        _tenantContext = tenantContext;
        _rmRead = rmRead;
        _rmSyncRuns = rmSyncRuns;
        _historico = historico;
        _rmOpts = rmOpts.Value;
        _logger = logger;
    }

    public async Task<RmSolicitacaoStatusSyncResponse> RunBatchAsync(
        RmSolicitacaoStatusSyncRequest request,
        int? maxPerRunOverride,
        CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrEmpty(tenantId))
            throw new InvalidOperationException("TenantId ausente para sync CODSTATUS.");

        var max = Math.Clamp(maxPerRunOverride ?? 50, 1, 500);

        IQueryable<SolicitacaoVaga> q = _db.SolicitacoesVaga
            .Where(x => !string.IsNullOrWhiteSpace(x.RmRequisicaoCodigo));

        if (request.Ids is { Count: > 0 })
            q = q.Where(x => request.Ids.Contains(x.Id));

        var entities = await q
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Take(max)
            .ToListAsync(ct);

        var maps = await _db.RmRequisicaoStatusMaps
            .Where(m => m.TenantId == tenantId)
            .AsNoTracking()
            .ToListAsync(ct);

        var runId = await _rmSyncRuns.StartAsync(
            new StartRmSyncRunRequest(RmSyncEntidadeNome, "codstatus", null),
            ct);

        var totalLidos = entities.Count;
        var atualizados = 0;
        var ignorados = 0;
        var erros = 0;
        string? erroGlobal = null;

        try
        {
            foreach (var entity in entities)
            {
                var r = await SyncOneTrackedAsync(entity, maps, ct);
                switch (r)
                {
                    case SyncDisposition.Updated:
                        atualizados++;
                        break;
                    case SyncDisposition.Ignored:
                        ignorados++;
                        break;
                    case SyncDisposition.Error:
                        erros++;
                        break;
                }
            }
        }
        catch (Exception ex)
        {
            erroGlobal = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
            _logger.LogError(ex, "SolicitacaoVaga CODSTATUS sync falhou ({Tenant})", tenantId);
        }

        try
        {
            var status = string.IsNullOrEmpty(erroGlobal)
                ? (erros > 0 ? RmSyncStatus.FalhaParcial : RmSyncStatus.Sucesso)
                : RmSyncStatus.Falha;
            var erroMsg = erroGlobal;
            if (erroMsg == null && erros > 0)
                erroMsg = $"{erros} solicitação(ões) com erro na sincronização CODSTATUS RM.";

            await _rmSyncRuns.FinishAsync(
                runId,
                new FinishRmSyncRunRequest(
                    status,
                    totalLidos,
                    Criados: 0,
                    Atualizados: atualizados,
                    Ignorados: ignorados,
                    ErroMensagem: erroMsg,
                    WatermarkNovoUtc: null),
                ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao finalizar RmSyncRun {RunId}", runId);
        }

        return new RmSolicitacaoStatusSyncResponse(totalLidos, atualizados, ignorados, erros, erroGlobal);
    }

    private enum SyncDisposition { Updated, Ignored, Error }

    private async Task<SyncDisposition> SyncOneTrackedAsync(
        SolicitacaoVaga entity,
        IReadOnlyList<RmRequisicaoStatusMap> maps,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        entity.RmUltimaSincronizacaoUtc = now;

        if (RmPortalRequisicaoVinculo.IsStub(entity.RmRequisicaoCodigo))
        {
            entity.RmStatusSyncUltimaMensagem = null;
            entity.RmUltimaStatusDescricaoRm = null;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Ignored;
        }

        if (!_rmOpts.IsConfigured)
        {
            entity.RmStatusSyncUltimaMensagem = "RM não configurado (syn).";
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Error;
        }

        RmRequisicaoCodStatusSnapshot? snap;
        try
        {
            snap = await _rmRead.TryGetCodStatusByPortalCodigoAsync(entity.RmRequisicaoCodigo!, ct);
        }
        catch (Exception ex)
        {
            entity.RmStatusSyncUltimaMensagem =
                $"Erro na leitura RM: {(ex.Message.Length > 1900 ? ex.Message[..1900] : ex.Message)}";
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Error;
        }

        if (snap is null)
        {
            entity.RmStatusSyncUltimaMensagem =
                "Requisição não localizada no RM. Use formato TIPO_REQUISICAO|CODCOLREQUISICAO|IDREQ em RmRequisicaoCodigo.";
            entity.RmUltimaStatusDescricaoRm = null;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Error;
        }

        var codShort = (short)snap.CodStatusRm;
        var desc = TrimTo(snap.StatusDescricao, 240);

        entity.RmCodStatus = codShort;
        entity.RmUltimaStatusDescricaoRm = desc;
        entity.RmStatusSyncUltimaMensagem = null;

        static bool Terminal(SolicitacaoStatus s) =>
            s is SolicitacaoStatus.Reprovada or SolicitacaoStatus.Cancelada or SolicitacaoStatus.Concluida
                or SolicitacaoStatus.ContratacaoConcluida or SolicitacaoStatus.EncerradaSemContratacao;

        static bool WorkflowInternoAindaBloqueiaSyncRm(SolicitacaoStatus s) =>
            s is SolicitacaoStatus.Rascunho
                or SolicitacaoStatus.PendenteAprovacao
                or SolicitacaoStatus.AjustesNecessarios
                or SolicitacaoStatus.PendenteAprovacaoRh
                or SolicitacaoStatus.PendenteAprovacaoAumentoHC
                or SolicitacaoStatus.PendenteTriagem
                or SolicitacaoStatus.EmTriagem
                or SolicitacaoStatus.DevolvidaTriagemGestor;

        if (Terminal(entity.Status))
        {
            entity.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Updated;
        }

        if (WorkflowInternoAindaBloqueiaSyncRm(entity.Status))
        {
            entity.RmStatusSyncUltimaMensagem = "Sync RM registrado sem alterar o workflow interno do portal.";
            entity.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Ignored;
        }

        var map = RmRequisicaoStatusMapResolver.ResolveFirst(maps, snap.CodStatusRm);

        if (map is null)
        {
            entity.RmStatusSyncUltimaMensagem = $"CODSTATUS {snap.CodStatusRm} sem mapa parametrizado (SYN-01).";
            entity.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Error;
        }

        if (!RmRequisicaoStatusMapResolver.TryParsePortalStatus(map, out var mappedStatus))
        {
            _logger.LogWarning("Mapa CODSTATUS {Cod}: PortalStatusKey inválido `{Key}`.", snap.CodStatusRm, map.PortalStatusKey);
            entity.RmStatusSyncUltimaMensagem = $"Mapa com PortalStatusKey inválido: {map.PortalStatusKey}";
            entity.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Error;
        }

        if (SolicitacaoVagaRmSyncWorkflowRank.WouldRegress(entity.Status, mappedStatus))
        {
            entity.RmStatusSyncUltimaMensagem = "Sync ignorado: regressão de status bloqueada.";
            entity.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Ignored;
        }

        if (entity.Status == mappedStatus)
        {
            entity.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(ct);
            return SyncDisposition.Updated;
        }

        var antes = entity.Status.ToString();
        entity.Status = mappedStatus;
        entity.UpdatedAtUtc = now;

        await _historico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga,
            entity.Id,
            antes,
            entity.Status.ToString(),
            funcionarioId: null,
            userId: null,
            alteradoPorNome: "Sistema (sync CODSTATUS RM)",
            observacao: $"RM CODSTATUS={snap.CodStatusRm}",
            ct);

        entity.RmStatusSyncUltimaMensagem = null;
        await _db.SaveChangesAsync(ct);
        return SyncDisposition.Updated;
    }

    private static string? TrimTo(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return null;
        s = s.Trim();
        return s.Length <= max ? s : s[..max];
    }
}
