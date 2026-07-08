using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Contracts.TenantOperationalReset;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Ops;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Logging.Helpers;

namespace RhPortal.Api.Application.TenantOperationalReset;

public sealed class TenantOperationalResetService : ITenantOperationalResetService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IHostEnvironment _env;
    private readonly ICandidatoService _candidatoService;
    private readonly ITalentoService _talentoService;
    private readonly ILogger<TenantOperationalResetService> _logger;

    public TenantOperationalResetService(
        AppDbContext db,
        ITenantContext tenantContext,
        IHostEnvironment env,
        ICandidatoService candidatoService,
        ITalentoService talentoService,
        ILogger<TenantOperationalResetService> logger)
    {
        _db = db;
        _tenantContext = tenantContext;
        _env = env;
        _candidatoService = candidatoService;
        _talentoService = talentoService;
        _logger = logger;
    }

    public async Task<OperationalResetPreviewResponse> GetPreviewAsync(CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var counts = await BuildCountsAsync(tenantId, ct);
        var (envName, _) = EnvironmentResolver.Resolve(_env);

        return new OperationalResetPreviewResponse(
            tenantId,
            OperationalResetEnvironment.IsAllowed(_env),
            envName,
            counts.WillRemove,
            counts.WillPreserve,
            BuildRemoveScope(
                counts.WillRemove,
                counts.DistribuicoesAnalista,
                counts.VagasRmFluxoPortal,
                counts.ProjetosRmVagas),
            BuildPreserveScope(counts.WillPreserve));
    }

    public async Task<OperationalResetExecuteResponse> ExecuteAsync(
        IResetProgressReporter? progress,
        CancellationToken ct)
    {
        if (!OperationalResetEnvironment.IsAllowed(_env))
            throw new InvalidOperationException("Reset operacional disponível apenas em Dev e Homologação.");

        var tenantId = RequireTenantId();
        var preview = await BuildCountsAsync(tenantId, ct);

        _logger.LogWarning(
            "OPERATIONAL RESET started for TenantId={TenantId} Candidatos={C} Talentos={T} VagasTeste={V}",
            tenantId, preview.WillRemove.Candidatos, preview.WillRemove.Talentos, preview.WillRemove.VagasTeste);

        await ReportAsync(progress, "start", "Iniciando reset operacional…", 0, ct);

        // Coletar antes de apagar candidatos — origem portal e vínculos somem com o fluxo.
        var talentoIdsRemover = await OperationalResetTalentoIdsQuery().ToListAsync(ct);

        // PropostaVaga e ProjetoCandidato usam Restrict no candidato — precisam sair antes do delete.
        await ReportAsync(progress, "vinculos", "Removendo propostas e participações em seleção…", 5, ct);
        var vinculosRemovidos = await ClearCandidateBlockingLinksAsync(tenantId, ct);
        await ReportAsync(
            progress,
            "vinculos",
            $"{vinculosRemovidos.Propostas} proposta(s) e {vinculosRemovidos.Participacoes} participação(ões) removida(s).",
            10,
            ct);

        await ReportAsync(progress, "candidatos", "Removendo candidatos…", 15, ct);
        var candidatosRemovidos = await _candidatoService.DeleteAllForTenantAsync(ct);
        await ReportAsync(progress, "candidatos", $"{candidatosRemovidos} candidato(s) removido(s).", 30, ct);

        await ReportAsync(progress, "talentos", "Removendo talentos de candidatura, site e demais origens do portal…", 35, ct);
        var talentosRemovidos = await _talentoService.DeleteByIdsAsync(talentoIdsRemover, ct);
        await ReportAsync(progress, "talentos", $"{talentosRemovidos} talento(s) removido(s).", 50, ct);

        await ReportAsync(progress, "sql", "Limpando admissões, vagas de teste e processos seletivos…", 55, ct);
        await ExecuteSqlCleanupAsync(tenantId, ct);
        await ReportAsync(progress, "sql", "Limpeza de dados operacionais concluída.", 90, ct);

        await ReportAsync(progress, "done", "Reset operacional concluído.", 100, ct);

        var removed = new OperationalResetCountsDto(
            candidatosRemovidos,
            talentosRemovidos,
            preview.WillRemove.Candidaturas,
            preview.WillRemove.PreAdmissoes,
            preview.WillRemove.VagasTeste,
            preview.WillRemove.SolicitacoesTeste,
            preview.WillRemove.ProcessoSeletivoRegistros,
            preview.WillPreserve.VagasRm,
            preview.WillPreserve.SolicitacoesRm);

        return new OperationalResetExecuteResponse(
            Ok: true,
            Message: "Reset operacional concluído com sucesso.",
            Removed: removed);
    }

    private string RequireTenantId()
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId) ||
            string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Selecione um tenant válido antes de executar o reset operacional.");
        return tenantId;
    }

    private async Task<(
        OperationalResetCountsDto WillRemove,
        OperationalResetCountsDto WillPreserve,
        int DistribuicoesAnalista,
        int VagasRmFluxoPortal,
        int ProjetosRmVagas)> BuildCountsAsync(
        string tenantId,
        CancellationToken ct)
    {
        var cleanupVagaIds = await CleanupVagasQuery(tenantId).Select(v => v.Id).ToListAsync(ct);
        var cleanupSolicitacaoIds = await CleanupSolicitacoesQuery(tenantId, cleanupVagaIds).Select(s => s.Id).ToListAsync(ct);

        var candidatos = await _db.Candidatos.AsNoTracking().CountAsync(ct);
        var talentosTotal = await _db.Talentos.AsNoTracking().CountAsync(ct);
        var talentos = await OperationalResetTalentoIdsQuery().CountAsync(ct);
        var talentosPreservados = Math.Max(0, talentosTotal - talentos);
        var candidaturas = await _db.Candidaturas.AsNoTracking().CountAsync(ct);
        var preAdmissoes = await _db.PreAdmissoes.AsNoTracking().CountAsync(ct);
        var distribuicoesAnalista = await _db.SolicitacoesVaga.AsNoTracking()
            .CountAsync(s => s.AnalistaRhResponsavelUserId != null, ct);

        var vagasRmFluxoPortal = await _db.Vagas.AsNoTracking()
            .CountAsync(v =>
                !cleanupVagaIds.Contains(v.Id) &&
                (v.Status != VagaStatus.Rascunho && v.Status != VagaStatus.NaoInformado), ct);

        var projetosRmVagas = await _db.Set<ProjetoVaga>().AsNoTracking()
            .CountAsync(p => !cleanupVagaIds.Contains(p.VagaId), ct);

        var projetos = await _db.Set<ProjetoVaga>().AsNoTracking().CountAsync(ct);
        var propostas = await _db.PropostasVaga.AsNoTracking()
            .CountAsync(p =>
                cleanupVagaIds.Contains(p.VagaId) || p.CandidaturaId != null, ct);
        var processoSeletivo = projetos + propostas + candidaturas;

        var vagasRm = await _db.Vagas.AsNoTracking().CountAsync(v => !cleanupVagaIds.Contains(v.Id), ct);
        var solicitacoesRm = await _db.SolicitacoesVaga.AsNoTracking()
            .CountAsync(s => !cleanupSolicitacaoIds.Contains(s.Id), ct);

        var willRemove = new OperationalResetCountsDto(
            candidatos,
            talentos,
            candidaturas,
            preAdmissoes,
            cleanupVagaIds.Count,
            cleanupSolicitacaoIds.Count,
            processoSeletivo,
            vagasRm,
            solicitacoesRm);

        var willPreserve = new OperationalResetCountsDto(
            0, talentosPreservados, 0, 0, 0, 0, 0,
            vagasRm,
            solicitacoesRm);

        return (willRemove, willPreserve, distribuicoesAnalista, vagasRmFluxoPortal, projetosRmVagas);
    }

    private static readonly OrigemTalento[] PortalTalentOrigins =
    [
        OrigemTalento.Email,
        OrigemTalento.Site,
        OrigemTalento.Candidatura,
        OrigemTalento.Pasta,
    ];

    /// <summary>Talentos gerados por fluxos do portal (site, candidatura, e-mail, pasta).</summary>
    private IQueryable<Guid> OperationalResetTalentoIdsQuery() =>
        _db.Talentos.AsNoTracking()
            .Where(t => PortalTalentOrigins.Contains(t.Origem))
            .Select(t => t.Id);

    private IQueryable<Vaga> CleanupVagasQuery(string tenantId) =>
        _db.Vagas.AsNoTracking().Where(v =>
            v.TenantId == tenantId &&
            v.OrigemTipo == VagaOrigemTipo.Manual &&
            (v.IdReqRmOrigem == null || v.IdReqRmOrigem.Trim() == "") &&
            v.UltimoCicloRmObservadoUtc == null);

    private IQueryable<SolicitacaoVaga> CleanupSolicitacoesQuery(
        string tenantId,
        IReadOnlyCollection<Guid> cleanupVagaIds) =>
        _db.SolicitacoesVaga.AsNoTracking().Where(s =>
            s.TenantId == tenantId &&
            (
                (s.VagaId != null && cleanupVagaIds.Contains(s.VagaId.Value)) ||
                (
                    s.RmIdReq == null &&
                    (s.RmRequisicaoCodigo == null ||
                     s.RmRequisicaoCodigo.Trim() == "" ||
                     s.RmRequisicaoCodigo.ToLower().StartsWith("stub-"))
                )
            ));

    private static IReadOnlyList<OperationalResetScopeItemDto> BuildRemoveScope(
        OperationalResetCountsDto c,
        int distribuicoesAnalista,
        int vagasRmFluxoPortal,
        int projetosRmVagas) =>
    [
        new("Candidatos", "Todos os candidatos e currículos do tenant.", c.Candidatos),
        new("Talentos do portal", "Talentos de site, candidatura, e-mail ou pasta (preserva cadastros manuais/PDF).", c.Talentos),
        new("Candidaturas e processo seletivo", "Kanban, etapas, propostas e projetos de vaga.", c.ProcessoSeletivoRegistros),
        new("Pré-admissões", "Fluxos de admissão em andamento ou concluídos.", c.PreAdmissoes),
        new("Vagas de teste", "Vagas criadas manualmente no portal, sem vínculo RM.", c.VagasTeste),
        new("Solicitações de teste", "Requisições STUB ou criadas só para homologação.", c.SolicitacoesTeste),
        new("Distribuições a analistas", "Atribuições de analistas de RH em requisições (inclui requisições RM preservadas).", distribuicoesAnalista),
        new("Fluxo em vagas RM", "Status de recrutamento e rodadas publicadas revertidos para rascunho nas vagas RM preservadas.", vagasRmFluxoPortal + projetosRmVagas),
    ];

    private static IReadOnlyList<OperationalResetScopeItemDto> BuildPreserveScope(OperationalResetCountsDto c) =>
    [
        new("Configurações do tenant", "SLA, headcount, integrações, branding e demais parâmetros.", 0),
        new("Requisições RM", "Solicitações sincronizadas ou com vínculo real ao TOTVS.", c.SolicitacoesRm),
        new("Vagas RM", "Vagas importadas ou observadas pela integração RM (sem estado de fluxo do portal).", c.VagasRm),
        new("Base de talentos", "Cadastros manuais e importação de PDF no banco de talentos.", c.Talentos),
        new("Cadastros base", "Usuários, cargos, centros de custo, funcionários e hierarquia.", 0),
        new("Integração TOTVS", "Checkpoints de sync e configuração de integração.", 0),
    ];

    private async Task ExecuteSqlCleanupAsync(string tenantId, CancellationToken ct)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            await _db.Database.ExecuteSqlRawAsync(
                """
                UPDATE "SolicitacoesVaga" SET "AnalistaRhResponsavelUserId" = NULL WHERE "TenantId" = {0};
                UPDATE "Vagas" SET "RecrutadorResponsavelUserId" = NULL, "RecrutadorResponsavel" = NULL WHERE "TenantId" = {0};

                DELETE FROM "CandidaturaEtapaHistoricos" WHERE "TenantId" = {0};
                DELETE FROM "NotificacoesCandidaturaLogs" WHERE "TenantId" = {0};
                DELETE FROM "PropostasVaga" WHERE "TenantId" = {0};
                DELETE FROM "ProjetoCandidatos" WHERE "TenantId" = {0};
                DELETE FROM "Candidaturas" WHERE "TenantId" = {0};
                DELETE FROM "AgendaEvents" WHERE "TenantId" = {0};

                DELETE FROM "HistoricosAlteracaoWorkflowRH" WHERE "TenantId" = {0};
                DELETE FROM "EtapasWorkflowRH" WHERE "TenantId" = {0};
                DELETE FROM "WorkflowsRH" WHERE "TenantId" = {0};

                DELETE FROM "PreAdmissaoDocumentos" WHERE "TenantId" = {0};
                DELETE FROM "PreAdmissaoDocumentosSolicitados" WHERE "TenantId" = {0};
                DELETE FROM "PreAdmissaoDependentes" WHERE "TenantId" = {0};
                DELETE FROM "PreAdmissoes" WHERE "TenantId" = {0};
                """,
                tenantId);

            await _db.Database.ExecuteSqlRawAsync(
                """
                DROP TABLE IF EXISTS cleanup_vagas;
                DROP TABLE IF EXISTS cleanup_solicitacoes;

                CREATE TEMP TABLE cleanup_vagas ON COMMIT DROP AS
                SELECT v."Id"
                FROM "Vagas" v
                WHERE v."TenantId" = {0}
                  AND COALESCE(v."OrigemTipo", 0) = 0
                  AND NULLIF(BTRIM(COALESCE(v."IdReqRmOrigem", '')), '') IS NULL
                  AND v."UltimoCicloRmObservadoUtc" IS NULL;

                CREATE TEMP TABLE cleanup_solicitacoes ON COMMIT DROP AS
                SELECT s."Id"
                FROM "SolicitacoesVaga" s
                WHERE s."TenantId" = {0}
                  AND (
                    s."VagaId" IN (SELECT "Id" FROM cleanup_vagas)
                    OR (
                      s."RmIdReq" IS NULL
                      AND (
                        NULLIF(BTRIM(COALESCE(s."RmRequisicaoCodigo", '')), '') IS NULL
                        OR s."RmRequisicaoCodigo" ILIKE 'STUB-%'
                      )
                    )
                  );
                """,
                tenantId);

            await _db.Database.ExecuteSqlRawAsync(
                """
                UPDATE "Candidatos"
                SET "VagaId" = NULL, "LastMatchVagaId" = NULL
                WHERE "TenantId" = {0}
                  AND (
                    "VagaId" IN (SELECT "Id" FROM cleanup_vagas)
                    OR "LastMatchVagaId" IN (SELECT "Id" FROM cleanup_vagas)
                  );

                UPDATE "CandidatoDocumentos" SET "VagaId" = NULL
                WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

                UPDATE "InboxItems" SET "VagaId" = NULL
                WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

                DELETE FROM "CandidatoVagaMatchingScores" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "CandidatoVagaLlmScores" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "VagaUnifiedMatchingCaches" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "RecruiterMatchingFeedbacks" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "BatchMatchingRunVagas" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

                DELETE FROM "ApprovalMagicLinks" WHERE "TenantId" = {0} AND "SolicitacaoId" IN (SELECT "Id" FROM cleanup_solicitacoes);
                DELETE FROM "SolicitacoesAprovacaoEtapas" WHERE "TenantId" = {0} AND "SolicitacaoId" IN (SELECT "Id" FROM cleanup_solicitacoes);
                DELETE FROM "SolicitacaoVagaIndicacoes" WHERE "TenantId" = {0} AND "SolicitacaoVagaId" IN (SELECT "Id" FROM cleanup_solicitacoes);
                DELETE FROM "SolicitacaoVagaIntegracaoTentativas" WHERE "TenantId" = {0} AND "SolicitacaoVagaId" IN (SELECT "Id" FROM cleanup_solicitacoes);

                DELETE FROM "HistoricosStatus"
                WHERE "TenantId" = {0}
                  AND (
                    ("TipoEntidade" = 1 AND "EntidadeId" IN (SELECT "Id" FROM cleanup_solicitacoes))
                    OR ("TipoEntidade" = 9 AND "EntidadeId" IN (SELECT "Id" FROM cleanup_vagas))
                  );

                UPDATE "SolicitacoesVaga" SET "VagaId" = NULL
                WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

                DELETE FROM "SolicitacoesVaga" WHERE "TenantId" = {0} AND "Id" IN (SELECT "Id" FROM cleanup_solicitacoes);

                DELETE FROM "OcupacoesHistorico" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "RespostasCampoPersonalizadoVaga" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "CamposPersonalizadosVaga" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);

                DELETE FROM "ProjetoCandidatos"
                WHERE "TenantId" = {0}
                  AND "ProjetoId" IN (
                    SELECT "Id" FROM "ProjetosVaga"
                    WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas)
                  );

                DELETE FROM "FasesProcesso"
                WHERE "TenantId" = {0}
                  AND "ProjetoId" IN (
                    SELECT "Id" FROM "ProjetosVaga"
                    WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas)
                  );

                DELETE FROM "ProjetosVaga" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "VagaBeneficios" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "VagaRequisitos" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "VagaEtapas" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "VagaPerguntas" WHERE "TenantId" = {0} AND "VagaId" IN (SELECT "Id" FROM cleanup_vagas);
                DELETE FROM "Vagas" WHERE "TenantId" = {0} AND "Id" IN (SELECT "Id" FROM cleanup_vagas);

                DELETE FROM "FasesProcesso"
                WHERE "TenantId" = {0}
                  AND "ProjetoId" IN (
                    SELECT p."Id" FROM "ProjetosVaga" p
                    WHERE p."TenantId" = {0}
                      AND p."VagaId" NOT IN (SELECT "Id" FROM cleanup_vagas)
                  );

                DELETE FROM "ProjetosVaga"
                WHERE "TenantId" = {0}
                  AND "VagaId" NOT IN (SELECT "Id" FROM cleanup_vagas);

                UPDATE "Vagas"
                SET "Status" = 1,
                    "DataAbertura" = NULL,
                    "DataEncerramento" = NULL,
                    "AlertaVagaSemFillSnoozeAteUtc" = NULL
                WHERE "TenantId" = {0}
                  AND "Id" NOT IN (SELECT "Id" FROM cleanup_vagas)
                  AND "Status" NOT IN (0, 1);
                """,
                tenantId);

            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    /// <summary>
    /// Remove vínculos Restrict que impedem a exclusão de candidatos (propostas e participações em projeto).
    /// </summary>
    private async Task<(int Propostas, int Participacoes)> ClearCandidateBlockingLinksAsync(
        string tenantId,
        CancellationToken ct)
    {
        var propostas = await _db.Database.ExecuteSqlRawAsync(
            """DELETE FROM "PropostasVaga" WHERE "TenantId" = {0};""",
            tenantId);
        var participacoes = await _db.Database.ExecuteSqlRawAsync(
            """DELETE FROM "ProjetoCandidatos" WHERE "TenantId" = {0};""",
            tenantId);
        return (propostas, participacoes);
    }

    private static Task ReportAsync(
        IResetProgressReporter? progress,
        string stage,
        string message,
        int percent,
        CancellationToken ct)
    {
        if (progress is null)
            return Task.CompletedTask;

        return progress.ReportAsync(
            new ResetProgressMessage(stage, message, percent, DateTimeOffset.UtcNow),
            ct);
    }
}
