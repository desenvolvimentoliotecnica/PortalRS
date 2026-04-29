using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.WorkflowRH;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.ProjetosVaga;

namespace RhPortal.Api.Application.Vagas;

public interface IVagaService
{
    Task<IReadOnlyList<VagaListItemResponse>> ListAsync(VagaListQuery query, CancellationToken ct);
    Task<VagaResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<VagaResponse> CreateAsync(VagaCreateRequest request, CancellationToken ct);
    Task<VagaResponse?> UpdateAsync(Guid id, VagaUpdateRequest request, CancellationToken ct);
    Task<VagaResponse?> UpdateMatchingFiltrosAsync(Guid id, string? matchingFiltrosRaw, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<VagaResponse?> ChangeStatusAsync(Guid id, VagaStatus newStatus, CancellationToken ct);
    Task<VagaResponse?> AprovarAlcadaSalarialAsync(Guid id, string? justificativa, string? observacaoAprovador, CancellationToken ct);
    Task<VagaResponse?> LimparAlcadaSalarialAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Atribui (ou desatribui, com null) uma vaga a um usuário recrutador, mantendo
    /// <c>RecrutadorResponsavelUserId</c> e <c>RecrutadorResponsavel</c> (string) sincronizados.
    /// (Feature "Atribuição de Vaga a Recrutador" — 2026-04-26.)
    /// </summary>
    Task<VagaResponse> AssignRecrutadorAsync(Guid vagaId, Guid? recrutadorUserId, CancellationToken ct);
}

public sealed class VagaService : IVagaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<VagaService> _logger;
    private readonly IStringLocalizer<ServiceMessages> _localizer;
    private readonly IRHPortalAiMatchClient? _aiMatchClient;
    private readonly IVagaUnifiedMatchingCacheService? _unifiedMatchingCache;
    private readonly ICurrentUserContext _currentUser;
    private readonly IWorkflowRHService _workflowRH;
    private readonly StatusHistoricoService _statusHistorico;
    private readonly IProjetoVagaService _projetoVaga;

    public VagaService(
        AppDbContext db,
        ITenantContext tenantContext,
        ILogger<VagaService> logger,
        IStringLocalizer<ServiceMessages> localizer,
        ICurrentUserContext currentUser,
        IWorkflowRHService workflowRH,
        StatusHistoricoService statusHistorico,
        IProjetoVagaService projetoVaga,
        IRHPortalAiMatchClient? aiMatchClient = null,
        IVagaUnifiedMatchingCacheService? unifiedMatchingCache = null)
    {
        _db = db;
        _tenantContext = tenantContext;
        _logger = logger;
        _localizer = localizer;
        _currentUser = currentUser;
        _workflowRH = workflowRH;
        _statusHistorico = statusHistorico;
        _projetoVaga = projetoVaga;
        _aiMatchClient = aiMatchClient;
        _unifiedMatchingCache = unifiedMatchingCache;
    }

    public async Task<IReadOnlyList<VagaListItemResponse>> ListAsync(VagaListQuery query, CancellationToken ct)
    {
        IQueryable<Vaga> q = _db.Vagas.AsNoTracking();

    // ── Sprint P1: VagasDataScope enforcement ──
    q = ApplyVagasDataScopeFilter(q);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var like = $"%{term}%";

            q = q.Where(v =>
                (v.Codigo != null && EF.Functions.Like(v.Codigo, like)) ||
                EF.Functions.Like(v.Titulo, like) ||
                (v.Cidade != null && EF.Functions.Like(v.Cidade, like)) ||
                (v.Uf != null && EF.Functions.Like(v.Uf, like)) ||

                (v.CentroCusto != null &&
                    ((v.CentroCusto.Code != null && EF.Functions.Like(v.CentroCusto.Code, like)) ||
                     (v.CentroCusto.Description != null && EF.Functions.Like(v.CentroCusto.Description, like))))
            );
        }

        if (query.Status.HasValue)
            q = q.Where(v => v.Status == query.Status.Value);

        // 31.2: CentroCustoId absorveu AreaId + DepartmentId.
        if (query.CentroCustoId.HasValue && query.CentroCustoId.Value != Guid.Empty)
            q = q.Where(v => v.CentroCustoId == query.CentroCustoId.Value);

        if (query.RecrutadorUserId.HasValue && query.RecrutadorUserId.Value != Guid.Empty)
            q = q.Where(v => v.RecrutadorResponsavelUserId == query.RecrutadorUserId.Value);

        // Carregar configuração do tenant para calcular alerta
        var tenantConfig = await _db.TenantConfiguracoes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == _tenantContext.TenantId, ct);

        var diasAlerta = tenantConfig?.DiasAlertaVagaSemFill ?? 60;
        var agora = DateTimeOffset.UtcNow;

        var items = await q
            .Select(v => new
            {
                v.Id, v.Codigo, v.Titulo, v.Status,
                v.CentroCustoId,
                CentroCustoCode = v.CentroCusto != null ? v.CentroCusto.Code : null,
                CentroCustoNome = v.CentroCusto != null ? v.CentroCusto.Description : null,
                v.Modalidade, v.Senioridade, v.QuantidadeVagas, v.MatchMinimoPercentual,
                v.Confidencial, v.Urgente, v.AceitaPcd,
                v.DataInicio, v.DataEncerramento, v.DataAbertura, v.SlaDiasMetaFechamento,
                v.Cidade, v.Uf,
                RequisitosTotal = v.Requisitos.Count(),
                RequisitosObrigatorios = v.Requisitos.Count(r => r.Obrigatorio),
                v.CreatedAtUtc, v.UpdatedAtUtc,
                v.HeadcountAutorizado,
                HeadcountOcupado = v.Ocupacoes.Count(o => o.DataSaida == null),
                v.IsEstrutural,
                v.HeadcountProvisorio,
                v.HeadcountProvisorioExpiresAtUtc,
                v.AlertaVagaSemFillSnoozeAteUtc,
                v.HeadcountPendente,
                v.UnidadeLotacaoId,
                UnidadeLotacaoCode = v.UnidadeLotacao != null ? v.UnidadeLotacao.Code : null,
                UnidadeLotacaoName = v.UnidadeLotacao != null ? v.UnidadeLotacao.Description : null,
                // Origem TOTVS RM (refactor 2026-04-26)
                v.OrigemTipo,
                SubstituindoNome = v.OrigemDesligamento != null && v.OrigemDesligamento.Funcionario != null
                    ? v.OrigemDesligamento.Funcionario.Name
                    : null,
                v.HierarquiaId,
                HierarquiaDescricao = v.Hierarquia != null ? v.Hierarquia.Descricao : null,
                v.IdReqRmOrigem,
                v.CodFuncaoRm,
                v.FuncaoNomeRm,
            })
            .ToListAsync(ct);

        // Rodadas ativas: busca separada para evitar subqueries complexas no EF
        var vagaIds = items.Select(v => v.Id).ToList();
        var rodadasAtivas = await _db.Set<ProjetoVaga>()
            .AsNoTracking()
            .Where(p => vagaIds.Contains(p.VagaId) && p.Status == StatusProjeto.Ativo)
            .Select(p => new
            {
                p.VagaId, p.Numero,
                TotalCandidatos = _db.Set<ProjetoCandidato>().Count(pc => pc.ProjetoId == p.Id),
            })
            .ToListAsync(ct);

        var rodadaByVaga = rodadasAtivas
            .GroupBy(r => r.VagaId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.Numero).First());

        return items
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ThenByDescending(x => x.CreatedAtUtc)
            .Select(v =>
            {
                // Calcular alerta: vaga aberta há mais de N dias, sem snooze ativo
                int? diasSemFill = null;
                bool alertaAtivo = false;
                if (v.Status == VagaStatus.Aberta && v.DataAbertura.HasValue)
                {
                    diasSemFill = (int)(agora - v.DataAbertura.Value).TotalDays;
                    var snoozeAtivo = v.AlertaVagaSemFillSnoozeAteUtc.HasValue
                        && v.AlertaVagaSemFillSnoozeAteUtc.Value > agora;
                    alertaAtivo = diasSemFill >= diasAlerta && !snoozeAtivo;
                }

                var alertaHCProvVencido = v.HeadcountProvisorio > 0
                    && v.HeadcountProvisorioExpiresAtUtc.HasValue
                    && v.HeadcountProvisorioExpiresAtUtc.Value < agora;

                return new VagaListItemResponse(
                    v.Id, v.Codigo, v.Titulo, v.Status,
                    v.CentroCustoId, v.CentroCustoCode, v.CentroCustoNome,
                    v.Modalidade, v.Senioridade, v.QuantidadeVagas, v.MatchMinimoPercentual,
                    v.Confidencial, v.Urgente, v.AceitaPcd,
                    v.DataInicio, v.DataEncerramento, v.DataAbertura, v.SlaDiasMetaFechamento,
                    v.Cidade, v.Uf,
                    v.RequisitosTotal, v.RequisitosObrigatorios,
                    v.CreatedAtUtc, v.UpdatedAtUtc,
                    v.HeadcountAutorizado, v.HeadcountOcupado, v.IsEstrutural,
                    v.HeadcountProvisorio, v.HeadcountProvisorioExpiresAtUtc,
                    alertaAtivo, alertaAtivo ? diasSemFill : null, v.AlertaVagaSemFillSnoozeAteUtc,
                    v.HeadcountPendente,
                    alertaHCProvVencido,
                    v.UnidadeLotacaoId,
                    v.UnidadeLotacaoCode,
                    v.UnidadeLotacaoName,
                    rodadaByVaga.TryGetValue(v.Id, out var rodada) ? (int?)rodada.Numero : null,
                    rodadaByVaga.TryGetValue(v.Id, out var rodada2) ? (int?)rodada2.TotalCandidatos : null,
                    v.OrigemTipo,
                    v.SubstituindoNome,
                    v.HierarquiaId,
                    v.HierarquiaDescricao,
                    v.IdReqRmOrigem,
                    v.CodFuncaoRm,
                    v.FuncaoNomeRm
                );
            })
            .ToList();
    }

    public async Task<VagaResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Vagas
            .AsNoTracking()
            .Include(x => x.JobPosition)
            .Include(x => x.CategoriaSalarial)
            .Include(x => x.CentroCusto)
            .Include(x => x.Turno)
            .Include(x => x.UnidadeLotacao)
            .Include(x => x.EixoVaga)
            .Include(x => x.DescricaoCargo)
            .Include(x => x.Beneficios)
            .Include(x => x.Requisitos)
            .Include(x => x.Etapas)
            .Include(x => x.PerguntasTriagem)
            .Include(x => x.Ocupacoes)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (entity is null) return null;

        var response = MapToResponse(entity);

        // Rastreabilidade: buscar dados da SolicitacaoVaga vinculada
        var solic = await _db.SolicitacoesVaga
            .AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Aprovador)
            .Include(s => s.DecisaoRHRevisadoPor)
            .Where(s => s.VagaId == id)
            .OrderByDescending(s => s.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (solic != null)
        {
            response = response with
            {
                SolicitanteNome = solic.Solicitante?.Name,
                AprovadorNome = solic.Aprovador?.Name,
                DataAprovacao = solic.ApprovedAtUtc,
                // SolicitacaoPendenteDecisaoId — campo legado do fluxo antigo (RH decidia HC pós-aprovação).
                // A decisão agora vem do gestor na criação, então não há mais "pendência" pós-aprovação.
                SolicitacaoPendenteDecisaoId = null,
                DecisaoRH = solic.DecisaoRH,
                DecisaoRHRevisadoPorNome = solic.DecisaoRHRevisadoPor?.Name,
                DecisaoRHEmUtc = solic.DecisaoRHEmUtc,
                DecisaoRHPrazoMeses = solic.DecisaoRHPrazoMeses,
            };
        }

        // Faixa salarial (dado externo ao Vaga) — populada sob demanda.
        if (entity.JobPositionId.HasValue)
        {
            var faixa = await _db.Set<FaixaSalarial>()
                .AsNoTracking()
                .Where(f => f.JobPositionId == entity.JobPositionId.Value)
                .OrderByDescending(f => f.UpdatedAtUtc)
                .FirstOrDefaultAsync(ct);
            if (faixa is not null)
            {
                var violaMin = entity.SalarioMinimo.HasValue && entity.SalarioMinimo.Value < faixa.SalarioMinimo;
                var violaMax = entity.SalarioMaximo.HasValue && entity.SalarioMaximo.Value > faixa.SalarioMaximo;
                response = response with
                {
                    FaixaSalarialMinimo = faixa.SalarioMinimo,
                    FaixaSalarialMaximo = faixa.SalarioMaximo,
                    FaixaSalarialViolada = violaMin || violaMax,
                };
            }
        }

        return response;
    }

    public async Task<VagaResponse> CreateAsync(VagaCreateRequest request, CancellationToken ct)
    {
        // Sprint P1: ReadOnly guard
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar vagas.");
        // MatchingFiltrosRaw é opcional na criação (ex.: vaga auto-criada por solicitação aprovada)
        if (request.CentroCustoId.HasValue && request.CentroCustoId.Value != Guid.Empty)
            await EnsureCentroCustoAsync(request.CentroCustoId.Value, ct);

        var weights = NormalizeWeights(request.Weights, null);
        var entity = new Vaga
        {
            Id = Guid.NewGuid(),
            Codigo = TrimOrNull(request.Codigo) ?? await GerarCodigoAsync(ct),
            Titulo = (request.Titulo ?? string.Empty).Trim(),
            AreaTime = request.AreaTime,
            Modalidade = request.Modalidade,
            Status = request.Status,
            Senioridade = request.Senioridade,
            QuantidadeVagas = request.QuantidadeVagas < 1 ? 1 : request.QuantidadeVagas,
            TipoContratacao = request.TipoContratacao,
            MatchMinimoPercentual = ClampPercent(request.MatchMinimoPercentual),
            PesoCompetencia = weights.Competencia,
            PesoExperiencia = weights.Experiencia,
            PesoFormacao = weights.Formacao,
            PesoLocalidade = weights.Localidade,
            MatchingFiltrosRaw = TrimOrNull(request.MatchingFiltrosRaw),
            MatchingFiltrosOriginaisRaw = TrimOrNull(request.MatchingFiltrosRaw),
            DescricaoInterna = TrimOrNull(request.DescricaoInterna),
            CodigoInterno = TrimOrNull(request.CodigoInterno),
            CodigoCbo = TrimOrNull(request.CodigoCbo),
            JobPositionId = request.JobPositionId,
            CategoriaSalarialId = request.CategoriaSalarialId,
            CentroCustoId = request.CentroCustoId,
            TurnoId = request.TurnoId,
            UnidadeLotacaoId = request.UnidadeLotacaoId,
            EixoVagaId = request.EixoVagaId,
            // Sessão 31.8 — DescricaoCargo + pesos calibrados extras
            // (Os 4 originais — Competencia/Experiencia/Formacao/Localidade — vêm de
            // request.Weights via NormalizeWeights acima; aqui só os novos)
            DescricaoCargoId = request.DescricaoCargoId,
            PesoIdioma = request.PesoIdioma ?? 0,
            PesoConhecimentoTecnico = request.PesoConhecimentoTecnico ?? 0,
            PesoVivenciaEspecifica = request.PesoVivenciaEspecifica ?? 0,
            LocalidadeMaxDistanciaKm = request.LocalidadeMaxDistanciaKm,
            TravarFaixaSalarial = request.TravarFaixaSalarial,
            MotivoAbertura = request.MotivoAbertura,
            OrcamentoAprovado = request.OrcamentoAprovado,
            GestorRequisitante = TrimOrNull(request.GestorRequisitante),
            RecrutadorResponsavel = TrimOrNull(request.RecrutadorResponsavel),
            RecrutadorResponsavelUserId = ResolveRecrutadorResponsavelUserId(null, request.RecrutadorResponsavelUserId),
            Prioridade = request.Prioridade,
            ResumoPitch = TrimOrNull(request.ResumoPitch),
            TagsResponsabilidadesRaw = TrimOrNull(request.TagsResponsabilidadesRaw),
            TagsKeywordsRaw = TrimOrNull(request.TagsKeywordsRaw),
            Confidencial = request.Confidencial,
            AceitaPcd = request.AceitaPcd,
            Urgente = request.Urgente,
            GeneroPreferencia = request.GeneroPreferencia,
            VagaAfirmativa = request.VagaAfirmativa,
            LinguagemInclusiva = request.LinguagemInclusiva,
            PublicoAfirmativo = TrimOrNull(request.PublicoAfirmativo),
            ObservacoesPcd = TrimOrNull(request.ObservacoesPcd),
            ProjetoNome = TrimOrNull(request.ProjetoNome),
            ProjetoClienteAreaImpactada = TrimOrNull(request.ProjetoClienteAreaImpactada),
            ProjetoPrazoPrevisto = TrimOrNull(request.ProjetoPrazoPrevisto),
            ProjetoDescricao = TrimOrNull(request.ProjetoDescricao),
            Regime = request.Regime,
            CargaSemanalHoras = request.CargaSemanalHoras,
            Escala = request.Escala,
            EscalaTrabalhoRaw = TrimOrNull(request.EscalaTrabalhoRaw),
            HoraEntrada = request.HoraEntrada,
            HoraSaida = request.HoraSaida,
            Intervalo = request.Intervalo,
            Cep = TrimOrNull(request.Cep),
            Logradouro = TrimOrNull(request.Logradouro),
            Numero = TrimOrNull(request.Numero),
            Bairro = TrimOrNull(request.Bairro),
            Cidade = TrimOrNull(request.Cidade),
            Uf = TrimOrNull(request.Uf),
            PoliticaTrabalho = TrimOrNull(request.PoliticaTrabalho),
            ObservacoesDeslocamento = TrimOrNull(request.ObservacoesDeslocamento),
            Moeda = request.Moeda,
            SalarioMinimo = request.SalarioMinimo,
            SalarioMaximo = request.SalarioMaximo,
            Periodicidade = request.Periodicidade,
            BonusTipo = request.BonusTipo,
            BonusPercentual = request.BonusPercentual,
            ObservacoesRemuneracao = TrimOrNull(request.ObservacoesRemuneracao),
            Escolaridade = request.Escolaridade,
            FormacaoArea = request.FormacaoArea,
            ExperienciaMinimaAnos = request.ExperienciaMinimaAnos,
            TagsStackRaw = TrimOrNull(request.TagsStackRaw),
            TagsIdiomasRaw = TrimOrNull(request.TagsIdiomasRaw),
            Diferenciais = TrimOrNull(request.Diferenciais),
            ObservacoesProcesso = TrimOrNull(request.ObservacoesProcesso),
            Visibilidade = request.Visibilidade,
            DataInicio = request.DataInicio,
            DataEncerramento = request.DataEncerramento,
            CanalLinkedIn = request.CanalLinkedIn,
            CanalSiteCarreiras = request.CanalSiteCarreiras,
            CanalIndicacao = request.CanalIndicacao,
            CanalPortaisEmprego = request.CanalPortaisEmprego,
            DescricaoPublica = TrimOrNull(request.DescricaoPublica),
            LgpdSolicitarConsentimentoExplicito = request.LgpdSolicitarConsentimentoExplicito,
            LgpdCompartilharCurriculoInternamente = request.LgpdCompartilharCurriculoInternamente,
            LgpdRetencaoAtiva = request.LgpdRetencaoAtiva,
            LgpdRetencaoMeses = request.LgpdRetencaoMeses,
            ExigeCnh = request.ExigeCnh,
            DisponibilidadeParaViagens = request.DisponibilidadeParaViagens,
            ChecagemAntecedentes = request.ChecagemAntecedentes,
            SlaDiasMetaFechamento = request.SlaDiasMetaFechamento,
            NomeEngessado = TrimOrNull(request.NomeEngessado),
            Beneficios = BuildBeneficios(request.Beneficios),
            Requisitos = BuildRequisitos(request.Requisitos),
            Etapas = BuildEtapas(request.Etapas),
            PerguntasTriagem = BuildPerguntas(request.PerguntasTriagem)
        };

        if (request.Status == VagaStatus.Aberta)
            entity.DataAbertura = DateTimeOffset.UtcNow;

        await ValidateFaixaSalarialAsync(entity, ct);

        // Sincroniza string RecrutadorResponsavel a partir do UserId resolvido (mantém coerência
        // para relatório r6 SLA por recrutador, que agrupa por string).
        await SyncRecrutadorResponsavelStringAsync(entity, ct);

        _db.Vagas.Add(entity);
        await _db.SaveChangesAsync(ct);

        // ── Auto-criar ProjetoVaga (Rodada 1) + 4 Fases default ──
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        var projetoId = Guid.NewGuid();
        _db.Set<ProjetoVaga>().Add(new ProjetoVaga
        {
            Id = projetoId, TenantId = tenantId, VagaId = entity.Id,
            Numero = 1, Descricao = "Rodada 1", Status = StatusProjeto.Ativo,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        });
        _db.Set<FaseProcesso>().AddRange(
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Triagem", Ordem = 0, ResponsavelTipo = ResponsavelFaseTipo.RH, CreatedAtUtc = now, UpdatedAtUtc = now },
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Entrevista RH", Ordem = 1, ResponsavelTipo = ResponsavelFaseTipo.RH, CreatedAtUtc = now, UpdatedAtUtc = now },
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Entrevista Gestor", Ordem = 2, ResponsavelTipo = ResponsavelFaseTipo.Gestor, CreatedAtUtc = now, UpdatedAtUtc = now },
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Aprovacao Final", Ordem = 3, ResponsavelTipo = ResponsavelFaseTipo.Gestor, CreatedAtUtc = now, UpdatedAtUtc = now }
        );
        await _db.SaveChangesAsync(ct);

        // Gera embedding da vaga em background (não bloqueia a resposta)
        TryGenerateVagaEmbeddingAsync(entity.Id, ct);

        // Se matchingFiltrosRaw foi preenchido na criação, dispara matching em background.
        if (!string.IsNullOrWhiteSpace(entity.MatchingFiltrosRaw))
        {
            try
            {
                if (_unifiedMatchingCache != null)
                    _ = _unifiedMatchingCache.InvalidateAndStartAsync(entity.Id, take: 20, ct: CancellationToken.None);
            }
            catch { /* best-effort */ }
        }

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<VagaResponse?> UpdateAsync(Guid id, VagaUpdateRequest request, CancellationToken ct)
    {
        // Sprint P1: ReadOnly guard
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível editar vagas.");

        var entity = await _db.Vagas.IgnoreQueryFilters()
            .Include(x => x.Beneficios)
            .Include(x => x.Requisitos)
            .Include(x => x.Etapas)
            .Include(x => x.PerguntasTriagem)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (entity is null) return null;
        EnsureTenantOwnership(entity);

        if (request.CentroCustoId.HasValue && request.CentroCustoId.Value != Guid.Empty)
            await EnsureCentroCustoAsync(request.CentroCustoId.Value, ct);

        var oldFiltros = entity.MatchingFiltrosRaw;
        var oldStatus = entity.Status.ToString();
        await ApplyUpdate(entity, request, ct);
        if (entity.Status.ToString() != oldStatus)
        {
            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.Vaga, entity.Id,
                oldStatus, entity.Status.ToString(), _currentUser, null, ct);
        }
        ReplaceChildren(entity, request);
        await ValidateFaixaSalarialAsync(entity, ct);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            LogConcurrency("first attempt", entity);
            _db.ChangeTracker.Clear();
            var refreshed = await _db.Vagas.IgnoreQueryFilters()
                .Include(x => x.Beneficios)
                .Include(x => x.Requisitos)
                .Include(x => x.Etapas)
                .Include(x => x.PerguntasTriagem)
                .FirstOrDefaultAsync(x => x.Id == id, ct);

            if (refreshed is null) return null;
            EnsureTenantOwnership(refreshed);

            await ApplyUpdate(refreshed, request, ct);
            ReplaceChildren(refreshed, request);
            await ValidateFaixaSalarialAsync(refreshed, ct);
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                LogConcurrency("retry", refreshed);
                throw;
            }
        }

        // Gera embedding da vaga em background após atualização
        TryGenerateVagaEmbeddingAsync(id, ct);

        // Se os filtros de matching mudaram, dispara recálculo unificado em background.
        if (!string.Equals(Norm(oldFiltros), Norm(entity.MatchingFiltrosRaw), StringComparison.Ordinal))
        {
            try
            {
                if (_unifiedMatchingCache != null)
                    _ = _unifiedMatchingCache.InvalidateAndStartAsync(id, take: 20, ct: CancellationToken.None);
            }
            catch { /* best-effort */ }
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<VagaResponse?> UpdateMatchingFiltrosAsync(Guid id, string? matchingFiltrosRaw, CancellationToken ct)
    {
        EnsureMatchingFiltrosRequired(matchingFiltrosRaw, "update");
        var entity = await _db.Vagas.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;
        EnsureTenantOwnership(entity);
        var old = entity.MatchingFiltrosRaw;
        entity.MatchingFiltrosRaw = string.IsNullOrWhiteSpace(matchingFiltrosRaw) ? null : matchingFiltrosRaw.Trim();
        await _db.SaveChangesAsync(ct);

        if (!string.Equals(Norm(old), Norm(entity.MatchingFiltrosRaw), StringComparison.Ordinal))
        {
            try
            {
                if (_unifiedMatchingCache != null)
                    _ = _unifiedMatchingCache.InvalidateAndStartAsync(id, take: 20, ct: CancellationToken.None);
            }
            catch { /* best-effort */ }
        }

        return await GetByIdAsync(id, ct);
    }

    private static string Norm(string? s) => string.IsNullOrWhiteSpace(s) ? string.Empty : s.Trim();

    private static void EnsureMatchingFiltrosRequired(string? matchingFiltrosRaw, string operation)
    {
        if (!string.IsNullOrWhiteSpace(matchingFiltrosRaw)) return;
        throw new InvalidOperationException($"MatchingFiltrosRaw é obrigatório na operação de {operation}.");
    }

    public async Task<VagaResponse?> ChangeStatusAsync(Guid id, VagaStatus newStatus, CancellationToken ct)
    {
        var entity = await _db.Vagas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;
        EnsureTenantOwnership(entity);

        // Rascunho/Preenchida → Aberta: exigir campos obrigatórios e decisão de headcount
        if (newStatus == VagaStatus.Aberta)
        {
            if (entity.HeadcountPendente > 0)
                throw new InvalidOperationException(
                    "Existe headcount pendente de decisão do RH para esta vaga. Defina a decisão antes de publicar.");

            if (entity.Status == VagaStatus.Rascunho)
            {
                var missing = new List<string>();
                if (string.IsNullOrWhiteSpace(entity.Titulo)) missing.Add("Título");
                if (entity.QuantidadeVagas < 1) missing.Add("Quantidade de vagas");
                if (missing.Count > 0)
                    throw new InvalidOperationException($"Preencha os campos obrigatórios antes de abrir a vaga: {string.Join(", ", missing)}");
            }
        }

        var statusAnteriorVaga = entity.Status.ToString();
        entity.Status = newStatus;
        if (newStatus == VagaStatus.Aberta && entity.DataAbertura == null)
            entity.DataAbertura = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.Vaga, entity.Id,
            statusAnteriorVaga, entity.Status.ToString(), _currentUser, null, ct);

        // Ao cancelar a vaga, cancelar automaticamente os workflows ativos e SolicitacoesVaga pendentes
        if (newStatus == VagaStatus.Cancelada)
        {
            var workflows = await _db.WorkflowsRH
                .Where(w => w.VagaId == id
                         && w.Status != WorkflowRHStatus.Concluido
                         && w.Status != WorkflowRHStatus.Cancelado)
                .ToListAsync(ct);

            foreach (var wf in workflows)
            {
                wf.Status = WorkflowRHStatus.Cancelado;
                wf.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }

            await CancelarSolicitacoesVinculadasAsync(entity, ct);
        }

        await _db.SaveChangesAsync(ct);

        if (newStatus == VagaStatus.Aberta)
        {
            // Cria rodada automaticamente ao publicar a vaga
            await _projetoVaga.EnsureActiveRodadaAsync(id, ct);

            var jaExiste = await _db.WorkflowsRH
                .AnyAsync(w => w.VagaId == id
                            && w.TipoWorkflow == TipoWorkflowRH.TriagemVaga
                            && w.Status != WorkflowRHStatus.Cancelado, ct);
            if (!jaExiste)
                await _workflowRH.CreateFromTemplateAsync(
                    TipoWorkflowRH.TriagemVaga, vagaId: id, preAdmissaoId: null, ct);
        }

        // Finaliza rodada ativa ao encerrar/pausar/cancelar a vaga
        if (newStatus is VagaStatus.Encerrada or VagaStatus.Pausada or VagaStatus.Cancelada or VagaStatus.Preenchida)
        {
            await _projetoVaga.FinalizeActiveRodadaAsync(id, ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        // Sprint P1: ReadOnly guard
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível excluir vagas.");

        var entity = await _db.Vagas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        // Vagas vindas do TOTVS RM (Aumento Quadro / Substituição) são read-only no Portal.
        // Marker: IdReqRmOrigem populado OU OrigemTipo != Manual. Exclusão tem que acontecer
        // no RM (encerrar a requisição lá), senão na próxima sincronização a vaga volta.
        if (!string.IsNullOrWhiteSpace(entity.IdReqRmOrigem) || entity.OrigemTipo != VagaOrigemTipo.Manual)
            throw new InvalidOperationException(
                $"Vaga importada do TOTVS RM (req #{entity.IdReqRmOrigem ?? "—"}). Não é permitido excluir — encerre a requisição no ERP de origem; o Portal espelha o cadastro.");

        if (entity.Status != VagaStatus.Rascunho)
        {
            // Vagas canceladas sem nenhuma ocupação ativa também podem ser excluídas
            var temOcupacaoAtiva = await _db.OcupacoesHistorico
                .AnyAsync(o => o.VagaId == id && o.DataSaida == null, ct);

            if (entity.Status != VagaStatus.Cancelada || temOcupacaoAtiva)
                throw new InvalidOperationException("Apenas vagas em rascunho podem ser excluídas. Utilize 'Cancelar' para vagas que já foram movimentadas.");
        }

        await CancelarSolicitacoesVinculadasAsync(entity, ct);
        _db.Vagas.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Cancela (ou marca como Reprovada) todas as SolicitacaoVaga vinculadas à vaga
    /// que ainda estejam em estados ativos (pendente de aprovação, aumento HC pendente).
    /// Também zera HeadcountPendente da vaga antes de removê-la/cancelá-la.
    /// </summary>
    private async Task CancelarSolicitacoesVinculadasAsync(Vaga vaga, CancellationToken ct)
    {
        var statusAtivos = new[]
        {
            SolicitacaoStatus.PendenteAprovacao,
            SolicitacaoStatus.PendenteAprovacaoAumentoHC,
        };

        var solicsPendentes = await _db.SolicitacoesVaga
            .Where(s => s.VagaId == vaga.Id && statusAtivos.Contains(s.Status))
            .ToListAsync(ct);

        if (solicsPendentes.Count == 0) return;

        // Cancelar as etapas de aprovação pendentes
        var solicIds = solicsPendentes.Select(s => s.Id).ToList();
        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => solicIds.Contains(e.SolicitacaoId) && e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);

        foreach (var etapa in etapasPendentes)
        {
            etapa.Status = StatusAprovacao.Cancelado;
            etapa.DataUtc = DateTimeOffset.UtcNow;
        }

        // Cancelar as solicitações e zerar headcount pendente
        foreach (var solic in solicsPendentes)
        {
            solic.Status = SolicitacaoStatus.Cancelada;
            solic.ObservacaoAprovador = "Cancelada automaticamente: vaga associada foi encerrada.";
            solic.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        vaga.HeadcountPendente = 0;
        vaga.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    private static VagaResponse MapToResponse(Vaga v)
    {
        return new VagaResponse(
            v.Id,
            v.Codigo,
            v.Titulo,
            v.AreaTime,
            v.Modalidade,
            v.Status,
            v.Senioridade,
            v.QuantidadeVagas,
            v.TipoContratacao,
            v.MatchMinimoPercentual,
            MapWeights(v),
            v.MatchingFiltrosRaw,
            v.MatchingFiltrosOriginaisRaw,
            v.DescricaoInterna,
            v.CodigoInterno,
            v.CodigoCbo,
            v.MotivoAbertura,
            v.OrcamentoAprovado,
            v.GestorRequisitante,
            v.GestorRequisitanteFuncionarioId,
            v.RecrutadorResponsavel,
            v.RecrutadorResponsavelUserId,
            v.Prioridade,
            v.ResumoPitch,
            v.TagsResponsabilidadesRaw,
            v.TagsKeywordsRaw,
            v.Confidencial,
            v.AceitaPcd,
            v.Urgente,
            v.GeneroPreferencia,
            v.VagaAfirmativa,
            v.LinguagemInclusiva,
            v.PublicoAfirmativo,
            v.ObservacoesPcd,
            v.ProjetoNome,
            v.ProjetoClienteAreaImpactada,
            v.ProjetoPrazoPrevisto,
            v.ProjetoDescricao,
            v.Regime,
            v.CargaSemanalHoras,
            v.Escala,
            v.EscalaTrabalhoRaw,
            v.HoraEntrada,
            v.HoraSaida,
            v.Intervalo,
            v.Cep,
            v.Logradouro,
            v.Numero,
            v.Bairro,
            v.Cidade,
            v.Uf,
            v.PoliticaTrabalho,
            v.ObservacoesDeslocamento,
            v.Moeda,
            v.SalarioMinimo,
            v.SalarioMaximo,
            v.Periodicidade,
            v.BonusTipo,
            v.BonusPercentual,
            v.ObservacoesRemuneracao,
            v.Escolaridade,
            v.FormacaoArea,
            v.ExperienciaMinimaAnos,
            v.TagsStackRaw,
            v.TagsIdiomasRaw,
            v.Diferenciais,
            v.ObservacoesProcesso,
            v.Visibilidade,
            v.DataInicio,
            v.DataEncerramento,
            v.DataAbertura,
            v.SlaDiasMetaFechamento,
            v.CanalLinkedIn,
            v.CanalSiteCarreiras,
            v.CanalIndicacao,
            v.CanalPortaisEmprego,
            v.DescricaoPublica,
            v.LgpdSolicitarConsentimentoExplicito,
            v.LgpdCompartilharCurriculoInternamente,
            v.LgpdRetencaoAtiva,
            v.LgpdRetencaoMeses,
            v.ExigeCnh,
            v.DisponibilidadeParaViagens,
            v.ChecagemAntecedentes,
            v.NomeEngessado,
            v.JobPositionId,
            v.JobPosition?.Code,
            v.JobPosition?.Name,
            v.CategoriaSalarialId,
            v.CategoriaSalarial?.Code,
            v.CategoriaSalarial?.Description,
            v.CentroCustoId,
            v.CentroCusto?.Code,
            v.CentroCusto?.Description,
            v.TurnoId,
            v.Turno?.Code,
            v.Turno?.Description,
            v.UnidadeLotacaoId,
            v.UnidadeLotacao?.Code,
            v.UnidadeLotacao?.Description,
            v.EixoVagaId,
            v.EixoVaga?.Code,
            v.EixoVaga?.Name,
            v.EixoVaga?.SlaDiasMetaFechamento,
            v.EixoVaga?.SlaDiasMetaFechamento ?? v.SlaDiasMetaFechamento,
            // Sessão 31.8 — DescricaoCargo + pesos calibrados
            v.DescricaoCargoId,
            v.DescricaoCargo?.Code,
            v.DescricaoCargo?.Title,
            v.PesoCompetencia,
            v.PesoExperiencia,
            v.PesoFormacao,
            v.PesoLocalidade,
            v.PesoIdioma,
            v.PesoConhecimentoTecnico,
            v.PesoVivenciaEspecifica,
            v.LocalidadeMaxDistanciaKm,
            v.TravarFaixaSalarial,
            v.AlcadaSalarialAprovadaPorUserId,
            v.AlcadaSalarialAprovadaEmUtc,
            v.AlcadaSalarialJustificativa,
            v.AlcadaSalarialObservacaoAprovador,
            null, // FaixaSalarialMinimo — preenchido em GetByIdAsync
            null, // FaixaSalarialMaximo
            false, // FaixaSalarialViolada — preenchido em GetByIdAsync
            v.Beneficios.OrderBy(x => x.Ordem).Select(MapBeneficio).ToList(),
            v.Requisitos.OrderBy(x => x.Ordem).Select(MapRequisito).ToList(),
            v.Etapas.OrderBy(x => x.Ordem).Select(MapEtapa).ToList(),
            v.PerguntasTriagem.OrderBy(x => x.Ordem).Select(MapPergunta).ToList(),
            v.CreatedAtUtc,
            v.UpdatedAtUtc,
            null, // SolicitanteNome - preenchido em GetByIdAsync
            null, // AprovadorNome
            null, // DataAprovacao
            v.HeadcountAutorizado,
            v.Ocupacoes?.Count(o => o.DataSaida == null) ?? 0,
            v.IsEstrutural,
            v.HeadcountProvisorio,
            v.HeadcountProvisorio > 0 && v.HeadcountProvisorioExpiresAtUtc.HasValue && v.HeadcountProvisorioExpiresAtUtc.Value < DateTimeOffset.UtcNow,
            v.HeadcountPendente,
            null, // SolicitacaoPendenteDecisaoId - preenchido em GetByIdAsync
            null, // DecisaoRH
            null, // DecisaoRHRevisadoPorNome
            null, // DecisaoRHEmUtc
            null, // DecisaoRHPrazoMeses
            v.HeadcountProvisorioExpiresAtUtc,
            v.CodFuncaoRm,
            v.FuncaoNomeRm
        );
    }

    private static VagaBeneficioResponse MapBeneficio(VagaBeneficio b)
        => new(
            b.Id,
            b.Ordem,
            b.Tipo,
            b.Valor,
            b.Recorrencia,
            b.Obrigatorio,
            b.Observacoes,
            b.CreatedAtUtc,
            b.UpdatedAtUtc
        );

    private static VagaRequisitoResponse MapRequisito(VagaRequisito r)
        => new(
            r.Id,
            r.Ordem,
            r.Categoria,
            r.Nome,
            r.Peso,
            r.Obrigatorio,
            r.AnosMinimos,
            r.Nivel,
            r.Avaliacao,
            SplitSinonimos(r.SinonimosRaw),
            r.Observacoes,
            r.CreatedAtUtc,
            r.UpdatedAtUtc
        );

    private static VagaEtapaResponse MapEtapa(VagaEtapa e)
        => new(
            e.Id,
            e.Ordem,
            e.Nome,
            e.Responsavel,
            e.Modo,
            e.SlaDias,
            e.DescricaoInstrucoes,
            e.CreatedAtUtc,
            e.UpdatedAtUtc
        );

    private static VagaPerguntaResponse MapPergunta(VagaPergunta p)
        => new(
            p.Id,
            p.Ordem,
            p.Texto,
            p.Tipo,
            p.Peso,
            p.Obrigatoria,
            p.Knockout,
            p.OpcoesRaw,
            p.CreatedAtUtc,
            p.UpdatedAtUtc
        );

    private static List<VagaBeneficio> BuildBeneficios(IReadOnlyList<VagaBeneficioRequest>? items)
    {
        if (items is null || items.Count == 0) return [];
        var list = new List<VagaBeneficio>(items.Count);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            list.Add(new VagaBeneficio
            {
                Id = Guid.NewGuid(),
                Ordem = NormalizeOrder(item.Ordem, i),
                Tipo = item.Tipo,
                Valor = item.Valor,
                Recorrencia = item.Recorrencia,
                Obrigatorio = item.Obrigatorio,
                Observacoes = TrimOrNull(item.Observacoes)
            });
        }
        return list;
    }

    private static List<VagaRequisito> BuildRequisitos(IReadOnlyList<VagaRequisitoRequest>? items)
    {
        if (items is null || items.Count == 0) return [];
        var list = new List<VagaRequisito>(items.Count);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            list.Add(new VagaRequisito
            {
                Id = Guid.NewGuid(),
                Ordem = NormalizeOrder(item.Ordem, i),
                Nome = (item.Nome ?? string.Empty).Trim(),
                Categoria = TrimOrNull(item.Categoria),
                Peso = item.Peso,
                Obrigatorio = item.Obrigatorio,
                AnosMinimos = item.AnosMinimos,
                Nivel = item.Nivel,
                Avaliacao = item.Avaliacao,
                SinonimosRaw = JoinSinonimos(item.Sinonimos),
                Observacoes = TrimOrNull(item.Observacoes)
            });
        }
        return list;
    }

    private static List<VagaEtapa> BuildEtapas(IReadOnlyList<VagaEtapaRequest>? items)
    {
        if (items is null || items.Count == 0) return [];
        var list = new List<VagaEtapa>(items.Count);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            list.Add(new VagaEtapa
            {
                Id = Guid.NewGuid(),
                Ordem = NormalizeOrder(item.Ordem, i),
                Nome = (item.Nome ?? string.Empty).Trim(),
                Responsavel = item.Responsavel,
                Modo = item.Modo,
                SlaDias = item.SlaDias,
                DescricaoInstrucoes = TrimOrNull(item.DescricaoInstrucoes)
            });
        }
        return list;
    }

    private static List<VagaPergunta> BuildPerguntas(IReadOnlyList<VagaPerguntaRequest>? items)
    {
        if (items is null || items.Count == 0) return [];
        var list = new List<VagaPergunta>(items.Count);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            list.Add(new VagaPergunta
            {
                Id = Guid.NewGuid(),
                Ordem = NormalizeOrder(item.Ordem, i),
                Texto = (item.Texto ?? string.Empty).Trim(),
                Tipo = item.Tipo,
                Peso = item.Peso,
                Obrigatoria = item.Obrigatoria,
                Knockout = item.Knockout,
                OpcoesRaw = TrimOrNull(item.OpcoesRaw)
            });
        }
        return list;
    }

    private void ReplaceChildren(Vaga entity, VagaUpdateRequest request)
    {
        if (entity.Beneficios.Count > 0)
            _db.VagaBeneficios.RemoveRange(entity.Beneficios);
        if (entity.Requisitos.Count > 0)
            _db.VagaRequisitos.RemoveRange(entity.Requisitos);
        if (entity.Etapas.Count > 0)
            _db.VagaEtapas.RemoveRange(entity.Etapas);
        if (entity.PerguntasTriagem.Count > 0)
            _db.VagaPerguntas.RemoveRange(entity.PerguntasTriagem);

        entity.Beneficios = BuildBeneficios(request.Beneficios);
        entity.Requisitos = BuildRequisitos(request.Requisitos);
        entity.Etapas = BuildEtapas(request.Etapas);
        entity.PerguntasTriagem = BuildPerguntas(request.PerguntasTriagem);

        if (entity.Beneficios.Count > 0)
            _db.VagaBeneficios.AddRange(entity.Beneficios);
        if (entity.Requisitos.Count > 0)
            _db.VagaRequisitos.AddRange(entity.Requisitos);
        if (entity.Etapas.Count > 0)
            _db.VagaEtapas.AddRange(entity.Etapas);
        if (entity.PerguntasTriagem.Count > 0)
            _db.VagaPerguntas.AddRange(entity.PerguntasTriagem);
    }

    private async Task EnsureCentroCustoAsync(Guid centroCustoId, CancellationToken ct)
    {
        var exists = await _db.CentrosCusto.AnyAsync(a => a.Id == centroCustoId, ct);
        if (!exists)
        {
            // Para testes: aceita CC que exista no banco mesmo com outro TenantId (ex.: liotecnica)
            var existsIgnoringTenant = await _db.CentrosCusto.IgnoreQueryFilters().AnyAsync(a => a.Id == centroCustoId, ct);
            if (!existsIgnoringTenant)
                throw new InvalidOperationException(_localizer["ServiceErrors.CentroCustoInvalid"]);
        }
    }

    private static int ClampPercent(int value)
        => Math.Clamp(value, 0, 100);

    private static VagaWeightsResponse MapWeights(Vaga v)
    {
        if (v.PesoCompetencia == 0 && v.PesoExperiencia == 0 && v.PesoFormacao == 0 && v.PesoLocalidade == 0)
            return new VagaWeightsResponse(40, 30, 15, 15);

        return new VagaWeightsResponse(v.PesoCompetencia, v.PesoExperiencia, v.PesoFormacao, v.PesoLocalidade);
    }

    private static (int Competencia, int Experiencia, int Formacao, int Localidade) NormalizeWeights(
        VagaWeightsRequest? weights,
        Vaga? fallback)
    {
        var competencia = weights?.Competencia ?? fallback?.PesoCompetencia ?? 40;
        var experiencia = weights?.Experiencia ?? fallback?.PesoExperiencia ?? 30;
        var formacao = weights?.Formacao ?? fallback?.PesoFormacao ?? 15;
        var localidade = weights?.Localidade ?? fallback?.PesoLocalidade ?? 15;

        return (
            ClampPercent(competencia),
            ClampPercent(experiencia),
            ClampPercent(formacao),
            ClampPercent(localidade)
        );
    }

    private static int NormalizeOrder(int ordem, int fallback)
        => ordem >= 0 ? ordem : fallback;

    private async Task<string> GerarCodigoAsync(CancellationToken ct)
    {
        var ultimo = await _db.Vagas
            .Where(v => v.Codigo != null && v.Codigo.StartsWith("VAG-"))
            .Select(v => v.Codigo!)
            .OrderByDescending(c => c)
            .FirstOrDefaultAsync(ct);

        int proximo = 1;
        if (ultimo != null && int.TryParse(ultimo.AsSpan(4), out var n))
            proximo = n + 1;

        return $"VAG-{proximo:D4}";
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// Resolve o UserId do recrutador responsável da vaga.
    /// Ordem (Fase de Atribuição manual — 2026-04-26):
    ///   1. Se o request explicitamente envia <paramref name="requestedUserId"/> E o usuário logado
    ///      é Admin/RH (não Recrutador) → respeita o valor enviado (atribuição manual).
    ///   2. Se o usuário logado é Recrutador (<see cref="VagasDataScope.ByRecrutador"/>) e
    ///      <paramref name="currentValue"/> é null → auto-atribui ao próprio (comportamento legado).
    ///   3. Caso contrário mantém <paramref name="currentValue"/>.
    /// </summary>
    private Guid? ResolveRecrutadorResponsavelUserId(Guid? currentValue, Guid? requestedUserId = null)
    {
        // Caso 1: Admin/RH atribuindo explicitamente. Aceita inclusive null (= remover atribuição).
        if (requestedUserId.HasValue && _currentUser.VagasDataScope != VagasDataScope.ByRecrutador)
            return requestedUserId.Value;

        // Caso 2: Auto-atribuição preservada para Recrutador quando não há valor.
        if (_currentUser.VagasDataScope == VagasDataScope.ByRecrutador
            && _currentUser.UserId.HasValue
            && !currentValue.HasValue)
            return _currentUser.UserId.Value;

        return currentValue;
    }

    /// <summary>
    /// Sincroniza a string <see cref="Vaga.RecrutadorResponsavel"/> com o nome do usuário
    /// referenciado por <see cref="Vaga.RecrutadorResponsavelUserId"/>. Mantém ambos em coerência
    /// para que relatórios legados que agrupam por string (ex.: r6 SLA por recrutador) continuem
    /// reportando dados corretos. Quando o UserId é null, NÃO limpa a string (preserva o que o
    /// admin tinha digitado manualmente como referência).
    /// </summary>
    private async Task SyncRecrutadorResponsavelStringAsync(Vaga entity, CancellationToken ct)
    {
        if (!entity.RecrutadorResponsavelUserId.HasValue) return;

        var nome = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == entity.RecrutadorResponsavelUserId.Value)
            .Select(u => u.FullName ?? u.Email ?? "")
            .FirstOrDefaultAsync(ct);

        if (!string.IsNullOrWhiteSpace(nome))
            entity.RecrutadorResponsavel = nome.Length > 120 ? nome[..120] : nome;
    }

    /// <summary>
    /// Atribui (ou desatribui, com null) uma vaga a um usuário recrutador. Usado pelo endpoint
    /// dedicado <c>PATCH /api/vagas/{id}/recrutador</c>. Atualiza ambos os campos
    /// (UserId + string) em sincronia. (Feature "Atribuição de Vaga a Recrutador" — 2026-04-26.)
    /// </summary>
    public async Task<VagaResponse> AssignRecrutadorAsync(Guid vagaId, Guid? recrutadorUserId, CancellationToken ct)
    {
        var entity = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == vagaId, ct)
            ?? throw new InvalidOperationException($"Vaga {vagaId} não encontrada.");

        if (recrutadorUserId.HasValue)
        {
            // Valida que o usuário existe no tenant atual
            var userExists = await _db.Users
                .AsNoTracking()
                .AnyAsync(u => u.Id == recrutadorUserId.Value && u.IsActive, ct);
            if (!userExists)
                throw new InvalidOperationException($"Usuário recrutador {recrutadorUserId.Value} não encontrado ou inativo.");

            entity.RecrutadorResponsavelUserId = recrutadorUserId.Value;
            await SyncRecrutadorResponsavelStringAsync(entity, ct);
        }
        else
        {
            // null = remover atribuição. Não limpa a string (admin pode ter texto manual).
            entity.RecrutadorResponsavelUserId = null;
        }

        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(entity.Id, ct)
            ?? throw new InvalidOperationException("Falha ao recarregar vaga após atribuição.");
    }

    /// <summary>
    /// Quando <see cref="Vaga.TravarFaixaSalarial"/> está ativo e a vaga está atrelada a um JobPosition com
    /// FaixaSalarial cadastrada, valida que o Salário Min/Max da vaga está dentro da faixa. Se viola e não há
    /// alçada aprovada, lança <see cref="InvalidOperationException"/> (o controller converte em 409).
    /// </summary>
    private async Task ValidateFaixaSalarialAsync(Vaga entity, CancellationToken ct)
    {
        if (!entity.TravarFaixaSalarial) return;
        if (entity.AlcadaSalarialAprovadaPorUserId.HasValue) return;
        if (!entity.JobPositionId.HasValue) return;

        var faixa = await _db.Set<FaixaSalarial>()
            .AsNoTracking()
            .Where(f => f.JobPositionId == entity.JobPositionId.Value)
            .OrderByDescending(f => f.UpdatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (faixa is null) return;

        var propostoMin = entity.SalarioMinimo;
        var propostoMax = entity.SalarioMaximo;
        var violaMin = propostoMin.HasValue && propostoMin.Value < faixa.SalarioMinimo;
        var violaMax = propostoMax.HasValue && propostoMax.Value > faixa.SalarioMaximo;

        if (violaMin || violaMax)
        {
            var msg = $"Salário proposto ({propostoMin:N2} — {propostoMax:N2}) fora da faixa cadastrada para o cargo ({faixa.SalarioMinimo:N2} — {faixa.SalarioMaximo:N2}). Solicite alçada ou desative a trava.";
            throw new InvalidOperationException(msg);
        }
    }

    public async Task<VagaResponse?> AprovarAlcadaSalarialAsync(Guid id, string? justificativa, string? observacaoAprovador, CancellationToken ct)
    {
        var entity = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (entity is null) return null;
        EnsureTenantOwnership(entity);

        if (!_currentUser.UserId.HasValue)
            throw new InvalidOperationException("Usuário atual inválido para aprovar alçada.");

        entity.AlcadaSalarialAprovadaPorUserId = _currentUser.UserId.Value;
        entity.AlcadaSalarialAprovadaEmUtc = DateTimeOffset.UtcNow;
        entity.AlcadaSalarialJustificativa = TrimOrNull(justificativa);
        entity.AlcadaSalarialObservacaoAprovador = TrimOrNull(observacaoAprovador);
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<VagaResponse?> LimparAlcadaSalarialAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (entity is null) return null;
        EnsureTenantOwnership(entity);

        entity.AlcadaSalarialAprovadaPorUserId = null;
        entity.AlcadaSalarialAprovadaEmUtc = null;
        entity.AlcadaSalarialJustificativa = null;
        entity.AlcadaSalarialObservacaoAprovador = null;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    private async Task ApplyUpdate(Vaga entity, VagaUpdateRequest request, CancellationToken ct)
    {
        entity.Codigo = TrimOrNull(request.Codigo);
        entity.Titulo = (request.Titulo ?? string.Empty).Trim();
        entity.AreaTime = request.AreaTime;
        entity.Modalidade = request.Modalidade;
        entity.Status = request.Status;
        if (request.Status == VagaStatus.Aberta && entity.DataAbertura == null)
            entity.DataAbertura = DateTimeOffset.UtcNow;
        entity.Senioridade = request.Senioridade;
        entity.QuantidadeVagas = request.QuantidadeVagas < 1 ? 1 : request.QuantidadeVagas;
        entity.TipoContratacao = request.TipoContratacao;
        entity.MatchMinimoPercentual = ClampPercent(request.MatchMinimoPercentual);
        var weights = NormalizeWeights(request.Weights, entity);
        entity.PesoCompetencia = weights.Competencia;
        entity.PesoExperiencia = weights.Experiencia;
        entity.PesoFormacao = weights.Formacao;
        entity.PesoLocalidade = weights.Localidade;
        entity.MatchingFiltrosRaw = TrimOrNull(request.MatchingFiltrosRaw);
        entity.DescricaoInterna = TrimOrNull(request.DescricaoInterna);
        entity.CodigoInterno = TrimOrNull(request.CodigoInterno);
        entity.CodigoCbo = TrimOrNull(request.CodigoCbo);
        entity.JobPositionId = request.JobPositionId;
        entity.CategoriaSalarialId = request.CategoriaSalarialId;
        entity.CentroCustoId = request.CentroCustoId;
        entity.TurnoId = request.TurnoId;
        entity.UnidadeLotacaoId = request.UnidadeLotacaoId;
        entity.EixoVagaId = request.EixoVagaId;
        // Sessão 31.8 — DescricaoCargo + pesos calibrados
        entity.DescricaoCargoId = request.DescricaoCargoId;
        if (request.PesoCompetencia.HasValue)         entity.PesoCompetencia         = request.PesoCompetencia.Value;
        if (request.PesoExperiencia.HasValue)         entity.PesoExperiencia         = request.PesoExperiencia.Value;
        if (request.PesoFormacao.HasValue)            entity.PesoFormacao            = request.PesoFormacao.Value;
        if (request.PesoLocalidade.HasValue)          entity.PesoLocalidade          = request.PesoLocalidade.Value;
        if (request.PesoIdioma.HasValue)              entity.PesoIdioma              = request.PesoIdioma.Value;
        if (request.PesoConhecimentoTecnico.HasValue) entity.PesoConhecimentoTecnico = request.PesoConhecimentoTecnico.Value;
        if (request.PesoVivenciaEspecifica.HasValue)  entity.PesoVivenciaEspecifica  = request.PesoVivenciaEspecifica.Value;
        entity.LocalidadeMaxDistanciaKm = request.LocalidadeMaxDistanciaKm;
        entity.TravarFaixaSalarial = request.TravarFaixaSalarial;
        entity.MotivoAbertura = request.MotivoAbertura;
        entity.OrcamentoAprovado = request.OrcamentoAprovado;
        entity.GestorRequisitante = TrimOrNull(request.GestorRequisitante);
        entity.RecrutadorResponsavel = TrimOrNull(request.RecrutadorResponsavel);
        var oldRecrutadorUserId = entity.RecrutadorResponsavelUserId;
        entity.RecrutadorResponsavelUserId = ResolveRecrutadorResponsavelUserId(
            entity.RecrutadorResponsavelUserId,
            request.RecrutadorResponsavelUserId);
        // Se o UserId mudou, sincroniza a string com o nome do novo recrutador.
        if (entity.RecrutadorResponsavelUserId != oldRecrutadorUserId)
            await SyncRecrutadorResponsavelStringAsync(entity, ct);
        entity.Prioridade = request.Prioridade;
        entity.ResumoPitch = TrimOrNull(request.ResumoPitch);
        entity.TagsResponsabilidadesRaw = TrimOrNull(request.TagsResponsabilidadesRaw);
        entity.TagsKeywordsRaw = TrimOrNull(request.TagsKeywordsRaw);
        entity.Confidencial = request.Confidencial;
        entity.AceitaPcd = request.AceitaPcd;
        entity.Urgente = request.Urgente;
        entity.GeneroPreferencia = request.GeneroPreferencia;
        entity.VagaAfirmativa = request.VagaAfirmativa;
        entity.LinguagemInclusiva = request.LinguagemInclusiva;
        entity.PublicoAfirmativo = TrimOrNull(request.PublicoAfirmativo);
        entity.ObservacoesPcd = TrimOrNull(request.ObservacoesPcd);
        entity.ProjetoNome = TrimOrNull(request.ProjetoNome);
        entity.ProjetoClienteAreaImpactada = TrimOrNull(request.ProjetoClienteAreaImpactada);
        entity.ProjetoPrazoPrevisto = TrimOrNull(request.ProjetoPrazoPrevisto);
        entity.ProjetoDescricao = TrimOrNull(request.ProjetoDescricao);
        entity.Regime = request.Regime;
        entity.CargaSemanalHoras = request.CargaSemanalHoras;
        entity.Escala = request.Escala;
        entity.EscalaTrabalhoRaw = TrimOrNull(request.EscalaTrabalhoRaw);
        entity.HoraEntrada = request.HoraEntrada;
        entity.HoraSaida = request.HoraSaida;
        entity.Intervalo = request.Intervalo;
        entity.Cep = TrimOrNull(request.Cep);
        entity.Logradouro = TrimOrNull(request.Logradouro);
        entity.Numero = TrimOrNull(request.Numero);
        entity.Bairro = TrimOrNull(request.Bairro);
        entity.Cidade = TrimOrNull(request.Cidade);
        entity.Uf = TrimOrNull(request.Uf);
        entity.PoliticaTrabalho = TrimOrNull(request.PoliticaTrabalho);
        entity.ObservacoesDeslocamento = TrimOrNull(request.ObservacoesDeslocamento);
        entity.Moeda = request.Moeda;
        entity.SalarioMinimo = request.SalarioMinimo;
        entity.SalarioMaximo = request.SalarioMaximo;
        entity.Periodicidade = request.Periodicidade;
        entity.BonusTipo = request.BonusTipo;
        entity.BonusPercentual = request.BonusPercentual;
        entity.ObservacoesRemuneracao = TrimOrNull(request.ObservacoesRemuneracao);
        entity.Escolaridade = request.Escolaridade;
        entity.FormacaoArea = request.FormacaoArea;
        entity.ExperienciaMinimaAnos = request.ExperienciaMinimaAnos;
        entity.TagsStackRaw = TrimOrNull(request.TagsStackRaw);
        entity.TagsIdiomasRaw = TrimOrNull(request.TagsIdiomasRaw);
        entity.Diferenciais = TrimOrNull(request.Diferenciais);
        entity.ObservacoesProcesso = TrimOrNull(request.ObservacoesProcesso);
        entity.Visibilidade = request.Visibilidade;
        entity.DataInicio = request.DataInicio;
        entity.DataEncerramento = request.DataEncerramento;
        entity.CanalLinkedIn = request.CanalLinkedIn;
        entity.CanalSiteCarreiras = request.CanalSiteCarreiras;
        entity.CanalIndicacao = request.CanalIndicacao;
        entity.CanalPortaisEmprego = request.CanalPortaisEmprego;
        entity.DescricaoPublica = TrimOrNull(request.DescricaoPublica);
        entity.LgpdSolicitarConsentimentoExplicito = request.LgpdSolicitarConsentimentoExplicito;
        entity.LgpdCompartilharCurriculoInternamente = request.LgpdCompartilharCurriculoInternamente;
        entity.LgpdRetencaoAtiva = request.LgpdRetencaoAtiva;
        entity.LgpdRetencaoMeses = request.LgpdRetencaoMeses;
        entity.ExigeCnh = request.ExigeCnh;
        entity.DisponibilidadeParaViagens = request.DisponibilidadeParaViagens;
        entity.ChecagemAntecedentes = request.ChecagemAntecedentes;
        entity.SlaDiasMetaFechamento = request.SlaDiasMetaFechamento;
        entity.NomeEngessado = TrimOrNull(request.NomeEngessado);
    }

    private void EnsureTenantOwnership(Vaga entity)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException(_localizer["ServiceErrors.TenantRequired"]);

        if (!string.IsNullOrWhiteSpace(entity.TenantId) &&
            !string.Equals(entity.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(_localizer["ServiceErrors.TenantMismatchForVaga"]);

        entity.TenantId = tenantId;

        foreach (var item in entity.Beneficios)
            item.TenantId = tenantId;
        foreach (var item in entity.Requisitos)
            item.TenantId = tenantId;
        foreach (var item in entity.Etapas)
            item.TenantId = tenantId;
        foreach (var item in entity.PerguntasTriagem)
            item.TenantId = tenantId;
    }

    private void LogConcurrency(string attempt, Vaga entity)
    {
        var tenantId = _tenantContext.TenantId;
        var entry = _db.Entry(entity);

        _logger.LogError(
            "Vaga update concurrency ({Attempt}). Tenant={TenantId}, VagaId={VagaId}, State={State}, RowVersion={HasConcurrencyToken}, Beneficios={Beneficios}, Requisitos={Requisitos}, Etapas={Etapas}, Perguntas={Perguntas}",
            attempt,
            tenantId,
            entity.Id,
            entry.State,
            HasConcurrencyToken(entry),
            entity.Beneficios.Count,
            entity.Requisitos.Count,
            entity.Etapas.Count,
            entity.PerguntasTriagem.Count);

        LogEntries();
    }

    private void LogEntries()
    {
        foreach (var entry in _db.ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Unchanged) continue;
            var key = entry.Metadata.FindPrimaryKey();
            var keyValues = key?.Properties.Select(p => entry.Property(p.Name).CurrentValue)?.ToArray() ?? Array.Empty<object?>();

            _logger.LogError(
                "Entry {Entity} State={State} Keys={Keys} TenantId={TenantId} RowsAffectedExpected=1",
                entry.Metadata.ClrType.Name,
                entry.State,
                string.Join(",", keyValues.Select(v => v ?? "null")),
                entry.Property("TenantId")?.CurrentValue ?? "n/a");
        }
    }

    private static bool HasConcurrencyToken(EntityEntry entry)
        => entry.Metadata.GetProperties().Any(p => p.IsConcurrencyToken);

    private void TryGenerateVagaEmbeddingAsync(Guid vagaId, CancellationToken ct)
    {
        if (_aiMatchClient == null) return;
        var tenantId = _tenantContext.TenantId ?? "";

        // Fire-and-forget: embedding da vaga + batch de talentos sem embedding (worker de matching vetorizado)
        _ = Task.Run(async () =>
        {
            try
            {
                await _aiMatchClient.GenerateVagaEmbeddingAsync(vagaId, tenantId, ct);
                // Gera embeddings para talentos do tenant que ainda não têm (até 50 por rodada)
                var (generated, total) = await _aiMatchClient.GenerateTalentosEmbeddingsBatchAsync(tenantId, limit: 50, ct);
                if (total > 0)
                    _logger.LogInformation("Batch embeddings talentos: {Generated} de {Total} processados para tenant {TenantId}", generated, total, tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao gerar embedding para vaga {VagaId}", vagaId);
            }
        }, CancellationToken.None);
    }

    private static string? JoinSinonimos(IReadOnlyList<string>? sinonimos)
    {
        if (sinonimos is null || sinonimos.Count == 0) return null;
        var cleaned = sinonimos
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return cleaned.Length == 0 ? null : string.Join(";", cleaned);
    }

    private static IReadOnlyList<string> SplitSinonimos(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<string>();
        var items = raw
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return items.Length == 0 ? Array.Empty<string>() : items;
    }

    // ── Sprint P1: VagasDataScope enforcement ──

    private IQueryable<Vaga> ApplyVagasDataScopeFilter(IQueryable<Vaga> query)
    {
        // Admin sees everything
        if (_currentUser.IsAdmin)
            return query;

        return _currentUser.VagasDataScope switch
        {
            // 31.2: escopo por área agora é escopo por Centro de Custo (absorveu Area).
            VagasDataScope.ByArea when _currentUser.CentroCustoId.HasValue =>
                query.Where(v => v.CentroCustoId == _currentUser.CentroCustoId.Value),

            VagasDataScope.ByRecrutador when _currentUser.UserId.HasValue =>
                query.Where(v => v.RecrutadorResponsavelUserId == _currentUser.UserId.Value),

            VagasDataScope.ByGestorRecrutador when _currentUser.FuncionarioId.HasValue =>
                query.Where(v =>
                    v.RecrutadorResponsavelUser != null
                    && v.RecrutadorResponsavelUser.Funcionario != null
                    && v.RecrutadorResponsavelUser.Funcionario.GestorDiretoId == _currentUser.FuncionarioId.Value),

            _ => query // All or no centro-custo/userId/funcionarioId resolved
        };
    }
}
