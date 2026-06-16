using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Dashboard;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using System.Globalization;
using System.Text;

namespace RhPortal.Api.Application.Dashboard;

/// <summary>
/// Fonte única de verdade para o endpoint <c>/api/dashboard/agregado?perfil=</c> (Sessão 31).
///
/// As três ondas (gestor, RH, diretor) são implementadas aqui porque o dashboard
/// precisa de uma visão consolidada que atravessa múltiplos módulos
/// (vagas, candidaturas, pré-admissões, solicitações, avaliações, notificações).
/// Centralizar em um único serviço evita um N+1 de chamadas do frontend e garante
/// que todas as queries rodem sob o mesmo query filter de tenant.
///
/// Regras do contrato:
/// - Todas as queries usam <see cref="DbContext"/> direto (não chamam outros serviços
///   para preservar isolamento por tenant via query filter e evitar ciclos de DI).
/// - Quando o perfil não tem dados a mostrar (ex.: gestor sem FuncionarioId), a
///   seção vem null em vez de 403. A responsabilidade de decidir "mostrar seletor"
///   fica no frontend.
/// </summary>
public interface IDashboardAgregadoService
{
    Task<DashboardAgregadoResponse> ObterAsync(string perfil, Guid? funcionarioId, CancellationToken ct);
    Task<DashboardGestorSection?> ParaGestorAsync(Guid funcionarioId, CancellationToken ct);
    Task<DashboardRhSection> ParaRhAsync(CancellationToken ct);
    Task<DashboardDiretorSection> ParaDiretorAsync(CancellationToken ct);
}

public sealed class DashboardAgregadoService : IDashboardAgregadoService
{
    private readonly AppDbContext _db;
    private readonly IOptions<SlaVagaOptions> _slaOptions;

    public DashboardAgregadoService(AppDbContext db, IOptions<SlaVagaOptions> slaOptions)
    {
        _db = db;
        _slaOptions = slaOptions;
    }

    // ── Fachada ───────────────────────────────────────────────────────────────

    public async Task<DashboardAgregadoResponse> ObterAsync(string perfil, Guid? funcionarioId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var normalizado = (perfil ?? string.Empty).Trim().ToLowerInvariant();

        DashboardGestorSection? gestor = null;
        DashboardRhSection? rh = null;
        DashboardDiretorSection? diretor = null;

        switch (normalizado)
        {
            case "gestor":
                if (funcionarioId.HasValue)
                    gestor = await ParaGestorAsync(funcionarioId.Value, ct);
                break;
            case "rh":
                rh = await ParaRhAsync(ct);
                break;
            case "diretor":
                diretor = await ParaDiretorAsync(ct);
                break;
            default:
                throw new ArgumentException(
                    $"Perfil '{perfil}' não suportado. Valores aceitos: gestor, rh, diretor.",
                    nameof(perfil));
        }

        return new DashboardAgregadoResponse(
            Perfil: normalizado,
            GeradoEmUtc: now,
            FuncionarioId: funcionarioId,
            Gestor: gestor,
            Rh: rh,
            Diretor: diretor);
    }

    // ── Onda 1 — Gestor ───────────────────────────────────────────────────────

    public async Task<DashboardGestorSection?> ParaGestorAsync(Guid funcionarioId, CancellationToken ct)
    {
        // 1. Diretos do gestor (funcionários com GestorDiretoId = eu, ativos).
        var diretos = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.GestorDiretoId == funcionarioId && f.Status == FuncionarioStatus.Active)
            .Select(f => new { f.Id, f.CentroCustoId, f.HasIncompleteData })
            .ToListAsync(ct);

        var diretosIds = diretos.Select(d => d.Id).ToHashSet();
        var diretosAtivos = diretos.Count;
        var diretosIncompletos = diretos.Count(d => d.HasIncompleteData);

        // 2. Centros de custo relevantes para a "carteira de vagas do gestor":
        //    o CC do próprio funcionário + os CCs dos diretos. Critério prático
        //    porque o schema não tem "gestor da vaga" estruturado — GestorRequisitante
        //    é string livre. Cobre o caso típico do gestor de CC que acompanha as
        //    vagas abertas no seu centro de responsabilidade.
        //    Em 31.2, CentroCusto absorveu Area.
        var meuFuncionario = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => new { f.CentroCustoId, f.UserId, f.Name, f.Email })
            .FirstOrDefaultAsync(ct);

        var (requisicoesPessoalAtivas, posicoesRequisicoesAtivas) =
            await ObterRequisicoesPessoalAtivasGestorAsync(funcionarioId, ct);

        var centrosCustoCarteira = diretos.Where(d => d.CentroCustoId.HasValue).Select(d => d.CentroCustoId!.Value).ToHashSet();
        if (meuFuncionario?.CentroCustoId is Guid meuCc)
            centrosCustoCarteira.Add(meuCc);

        var vagasCarteiraQuery = _db.Vagas.AsNoTracking()
            .Where(v => v.Status == VagaStatus.Aberta
                        && !v.IsEstrutural
                        && v.CentroCustoId.HasValue
                        && centrosCustoCarteira.Contains(v.CentroCustoId!.Value));

        var carteiraVagas = await vagasCarteiraQuery
            .Select(v => new
            {
                v.Id,
                v.Codigo,
                v.Titulo,
                v.DataAbertura,
                v.SlaDiasMetaFechamento,
                v.Urgente,
                v.Prioridade
            })
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var slaOpts = _slaOptions.Value;
        var carteiraMapeada = carteiraVagas
            .Select(v =>
            {
                var metaDias = SlaVagaMetaResolver.GetDiasMeta(v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade, slaOpts);
                var diasAberta = v.DataAbertura.HasValue
                    ? (int)Math.Max(0, Math.Round((now - v.DataAbertura.Value).TotalDays))
                    : 0;
                return new
                {
                    v.Id,
                    v.Codigo,
                    v.Titulo,
                    DiasAberta = diasAberta,
                    ForaDoSla = v.DataAbertura.HasValue && diasAberta > metaDias,
                    MetaDias = metaDias
                };
            })
            .ToList();

        var carteiraAbertas = carteiraMapeada.Count;
        var carteiraParadas = carteiraMapeada.Count(v => v.ForaDoSla);
        var carteiraVagaIds = carteiraMapeada.Select(v => v.Id).ToHashSet();

        // 3. Candidaturas ativas e em etapa avançada nas vagas da carteira.
        int candidaturasAtivas = 0;
        int candidaturasAvancadas = 0;
        if (carteiraVagaIds.Count > 0)
        {
            candidaturasAtivas = await _db.Candidaturas.AsNoTracking()
                .CountAsync(c => carteiraVagaIds.Contains(c.VagaId) && c.Status == CandidaturaStatus.Ativa, ct);

            candidaturasAvancadas = await _db.Candidaturas.AsNoTracking()
                .CountAsync(c => carteiraVagaIds.Contains(c.VagaId)
                                 && c.Status == CandidaturaStatus.Ativa
                                 && (c.EtapaMacro == EtapaMacroCandidatura.Entrevista
                                     || c.EtapaMacro == EtapaMacroCandidatura.EntrevistaTecnica
                                     || c.EtapaMacro == EtapaMacroCandidatura.Teste
                                     || c.EtapaMacro == EtapaMacroCandidatura.Proposta), ct);
        }

        // 4. Aprovações onde EU sou o aprovador resolvido (não entra fila de perfil).
        var aprovacoesPendentes = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .CountAsync(e => e.Status == StatusAprovacao.Pendente && e.AprovadorId == funcionarioId, ct);

        // 5. Solicitações da equipe (diretos) em aberto.
        int solicitacoesEquipePendentes = 0;
        if (diretosIds.Count > 0)
        {
            // Consideramos "em aberto" = PendenteAprovacao, AjustesNecessarios, Rascunho,
            // PendenteAprovacaoRh — tudo que ainda aguarda ação (e não terminou).
            bool AbertoSolicitacao(SolicitacaoStatus s) =>
                s == SolicitacaoStatus.PendenteAprovacao
                || s == SolicitacaoStatus.AjustesNecessarios
                || s == SolicitacaoStatus.PendenteAprovacaoRh;

            // SolicitacaoFerias.SolicitanteId = colaborador que pediu; assumimos
            // que o gestor "vê" as férias dos próprios diretos.
            var ferias = await _db.SolicitacoesFerias.AsNoTracking()
                .Where(s => diretosIds.Contains(s.SolicitanteId))
                .Select(s => s.Status)
                .ToListAsync(ct);
            solicitacoesEquipePendentes += ferias.Count(AbertoSolicitacao);

            // SolicitacaoPromocao.FuncionarioId = funcionário a ser promovido —
            // quem "pertence à carteira do gestor" é o funcionário alvo, não o criador.
            var promo = await _db.SolicitacoesPromocao.AsNoTracking()
                .Where(s => diretosIds.Contains(s.FuncionarioId))
                .Select(s => s.Status)
                .ToListAsync(ct);
            solicitacoesEquipePendentes += promo.Count(AbertoSolicitacao);

            // Solicitação de abertura de vaga usa enum próprio (SolicitacaoVagaStatus).
            var vagas = await _db.SolicitacoesVaga.AsNoTracking()
                .Where(s => diretosIds.Contains(s.SolicitanteId))
                .Select(s => s.Status)
                .ToListAsync(ct);
            solicitacoesEquipePendentes += vagas.Count(s =>
                s == SolicitacaoStatus.PendenteAprovacao
                || s == SolicitacaoStatus.AjustesNecessarios
                || s == SolicitacaoStatus.PendenteAprovacaoRh);
        }

        // 6. Avaliações de diretos pendentes (eu sou avaliador dos meus subordinados).
        int avaliacoesDiretosPendentes = 0;
        if (diretosIds.Count > 0)
        {
            avaliacoesDiretosPendentes = await _db.AvaliacaoConvites.AsNoTracking()
                .CountAsync(c => c.AvaliadorId == funcionarioId
                                 && c.Status == AvaliacaoConviteStatus.Pendente
                                 && diretosIds.Contains(c.AvaliandoId), ct);
        }

        // 7. Listas curtas (ranking por mais antigas e candidaturas em destaque).
        var vagasMaisAntigas = carteiraMapeada
            .Where(v => v.DiasAberta > 0)
            .OrderByDescending(v => v.DiasAberta)
            .Take(5)
            .Select(v => new DashboardGestorVagaAbertaItem(
                v.Id, v.Codigo, v.Titulo, v.DiasAberta, v.ForaDoSla,
                Candidaturas: 0))
            .ToList();

        // Complementa candidaturas por vaga nas top5.
        if (vagasMaisAntigas.Count > 0)
        {
            var vagaIdsTop = vagasMaisAntigas.Select(v => v.VagaId).ToList();
            var countsPorVaga = await _db.Candidaturas.AsNoTracking()
                .Where(c => vagaIdsTop.Contains(c.VagaId) && c.Status == CandidaturaStatus.Ativa)
                .GroupBy(c => c.VagaId)
                .Select(g => new { VagaId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var countMap = countsPorVaga.ToDictionary(x => x.VagaId, x => x.Count);
            vagasMaisAntigas = vagasMaisAntigas
                .Select(v => v with { Candidaturas = countMap.TryGetValue(v.VagaId, out var c) ? c : 0 })
                .ToList();
        }

        List<DashboardGestorCandidaturaItem> candidaturasDestaque = new();
        if (carteiraVagaIds.Count > 0)
        {
            var etapasAvancadas = new[]
            {
                EtapaMacroCandidatura.Entrevista,
                EtapaMacroCandidatura.EntrevistaTecnica,
                EtapaMacroCandidatura.Teste,
                EtapaMacroCandidatura.Proposta,
            };
            var linhas = await _db.Candidaturas.AsNoTracking()
                .Include(c => c.Vaga)
                .Include(c => c.Candidato)
                .Where(c => carteiraVagaIds.Contains(c.VagaId)
                            && c.Status == CandidaturaStatus.Ativa
                            && etapasAvancadas.Contains(c.EtapaMacro))
                .OrderByDescending(c => c.EtapaAtualDesdeUtc ?? c.UpdatedAtUtc)
                .Take(5)
                .Select(c => new
                {
                    c.Id,
                    c.VagaId,
                    VagaTitulo = c.Vaga != null ? c.Vaga.Titulo : null,
                    CandidatoId = c.Candidato != null ? c.Candidato.Id : Guid.Empty,
                    CandidatoNome = c.Candidato != null ? c.Candidato.Nome : "(sem nome)",
                    Etapa = c.EtapaMacro,
                    DesdeUtc = c.EtapaAtualDesdeUtc,
                })
                .ToListAsync(ct);

            candidaturasDestaque = linhas
                .Select(l => new DashboardGestorCandidaturaItem(
                    l.Id,
                    l.VagaId,
                    l.VagaTitulo,
                    l.CandidatoId,
                    l.CandidatoNome,
                    l.Etapa.ToString(),
                    l.DesdeUtc.HasValue
                        ? (int)Math.Max(0, Math.Round((now - l.DesdeUtc.Value).TotalDays))
                        : (int?)null))
                .ToList();
        }

        var agendaTecnicaProxima = await ObterAgendaTecnicaGestorAsync(
            carteiraVagaIds,
            meuFuncionario?.Name,
            meuFuncionario?.Email,
            now,
            ct);

        return new DashboardGestorSection(
            DiretosAtivos: diretosAtivos,
            DiretosComDadosIncompletos: diretosIncompletos,
            CarteiraVagasAbertas: carteiraAbertas,
            CarteiraVagasParadas: carteiraParadas,
            CarteiraCandidaturasAtivas: candidaturasAtivas,
            CandidaturasEtapaAvancada: candidaturasAvancadas,
            AprovacoesPendentesMinhas: aprovacoesPendentes,
            SolicitacoesEquipePendentes: solicitacoesEquipePendentes,
            RequisicoesPessoalAtivas: requisicoesPessoalAtivas,
            PosicoesRequisicoesAtivas: posicoesRequisicoesAtivas,
            AvaliacoesDiretosPendentes: avaliacoesDiretosPendentes,
            VagasMaisAntigas: vagasMaisAntigas,
            CandidaturasEmDestaque: candidaturasDestaque,
            AgendaTecnicaProxima: agendaTecnicaProxima);
    }

    private async Task<IReadOnlyList<DashboardGestorAgendaTecnicaItem>> ObterAgendaTecnicaGestorAsync(
        IReadOnlySet<Guid> carteiraVagaIds,
        string? gestorNome,
        string? gestorEmail,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var inicio = now.UtcDateTime;
        var fim = now.AddDays(30).UtcDateTime;
        var ownerTokens = new[]
        {
            NormalizeForComparison(gestorNome),
            NormalizeForComparison(gestorEmail),
        }.Where(x => !string.IsNullOrWhiteSpace(x)).ToArray();

        var futuros = await _db.AgendaEvents
            .AsNoTracking()
            .Include(x => x.Type)
            .Where(e => e.StartAtUtc >= inicio && e.StartAtUtc < fim)
            .Where(e =>
                (e.Type != null && e.Type.Code == "entrevista")
                || e.Title.Contains("Entrevista"))
            .OrderBy(e => e.StartAtUtc)
            .Take(80)
            .Select(e => new
            {
                e.Id,
                e.CandidaturaId,
                e.CandidatoId,
                e.VagaId,
                e.Title,
                e.StartAtUtc,
                e.EndAtUtc,
                e.Status,
                e.Location,
                e.Owner,
                e.Notes,
                e.Candidate,
                e.VagaTitle,
                e.VagaCode,
                e.CandidateResponseStatus,
                TypeCode = e.Type != null ? e.Type.Code : string.Empty,
                TypeLabel = e.Type != null ? e.Type.Label : string.Empty,
            })
            .ToListAsync(ct);

        return futuros
            .Where(e =>
                (e.VagaId.HasValue && carteiraVagaIds.Contains(e.VagaId.Value))
                || OwnerMatches(e.Owner, ownerTokens)
                || ParticipantMatches(e.Notes, ownerTokens))
            .Take(6)
            .Select(e => new DashboardGestorAgendaTecnicaItem(
                e.Id,
                e.CandidaturaId,
                e.CandidatoId,
                e.VagaId,
                e.Title,
                e.StartAtUtc,
                e.EndAtUtc,
                e.Status,
                e.Location,
                e.Owner,
                e.Candidate,
                e.VagaTitle,
                e.VagaCode,
                e.CandidateResponseStatus,
                e.TypeCode,
                e.TypeLabel))
            .ToList();
    }

    // ── Onda 2 — RH ───────────────────────────────────────────────────────────

    public async Task<DashboardRhSection> ParaRhAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var inicioSemana = now.AddDays(-7);
        var inicioMes = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var horas48 = now.AddHours(-48);

        // Vagas.
        var vagasAbertas = await _db.Vagas.AsNoTracking()
            .CountAsync(v => v.Status == VagaStatus.Aberta && !v.IsEstrutural, ct);
        var vagasRascunho = await _db.Vagas.AsNoTracking()
            .CountAsync(v => v.Status == VagaStatus.Rascunho, ct);

        var vagasParaSla = await _db.Vagas.AsNoTracking()
            .Where(v => v.Status == VagaStatus.Aberta && !v.IsEstrutural && v.DataAbertura != null)
            .Select(v => new { v.Id, v.Codigo, v.Titulo, v.DataAbertura, v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade, v.CentroCustoId })
            .ToListAsync(ct);

        var slaOpts = _slaOptions.Value;
        var foraSlaDetalhe = vagasParaSla
            .Select(v =>
            {
                var metaDias = SlaVagaMetaResolver.GetDiasMeta(v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade, slaOpts);
                var diasAberta = v.DataAbertura.HasValue
                    ? (int)Math.Max(0, Math.Round((now - v.DataAbertura!.Value).TotalDays))
                    : 0;
                return new
                {
                    v.Id,
                    v.Codigo,
                    v.Titulo,
                    v.CentroCustoId,
                    DiasAberta = diasAberta,
                    MetaDias = metaDias,
                    ForaDoSla = diasAberta > metaDias,
                };
            })
            .Where(x => x.ForaDoSla)
            .OrderByDescending(x => x.DiasAberta)
            .ToList();

        var vagasForaSla = foraSlaDetalhe.Count;
        var foraSlaTop = new List<DashboardRhVagaForaSlaItem>();
        if (foraSlaDetalhe.Count > 0)
        {
            // Em 31.2 CentroCusto absorveu Area — exibimos Description do CC no dashboard.
            var ccIds = foraSlaDetalhe.Where(x => x.CentroCustoId.HasValue).Select(x => x.CentroCustoId!.Value).Distinct().ToList();
            var ccMap = await _db.CentrosCusto.AsNoTracking()
                .Where(cc => ccIds.Contains(cc.Id))
                .Select(cc => new { cc.Id, cc.Description })
                .ToListAsync(ct);
            var ccLookup = ccMap.ToDictionary(cc => cc.Id, cc => cc.Description);

            foraSlaTop = foraSlaDetalhe
                .Take(5)
                .Select(x => new DashboardRhVagaForaSlaItem(
                    x.Id, x.Codigo, x.Titulo,
                    x.CentroCustoId.HasValue && ccLookup.TryGetValue(x.CentroCustoId.Value, out var nome) ? nome : null,
                    x.DiasAberta, x.MetaDias))
                .ToList();
        }

        // Pipeline (conta por EtapaMacro; contratações = no mês atual).
        var etapasCounts = await _db.Candidaturas.AsNoTracking()
            .Where(c => c.Status == CandidaturaStatus.Ativa)
            .GroupBy(c => c.EtapaMacro)
            .Select(g => new { Etapa = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var etapaLookup = etapasCounts.ToDictionary(x => x.Etapa, x => x.Count);
        int Etapa(EtapaMacroCandidatura e) => etapaLookup.TryGetValue(e, out var c) ? c : 0;

        var contratadosMes = await _db.Candidaturas.AsNoTracking()
            .CountAsync(c => c.Status == CandidaturaStatus.Contratado
                             && c.UpdatedAtUtc >= inicioMes, ct);

        // Pré-admissões.
        var statusEmAndamento = new[]
        {
            PreAdmissaoStatus.Enviado,
            PreAdmissaoStatus.Acessado,
            PreAdmissaoStatus.Preenchido,
            PreAdmissaoStatus.PreenchidoParcial,
        };
        var preEmAndamento = await _db.PreAdmissoes.AsNoTracking()
            .CountAsync(p => statusEmAndamento.Contains(p.Status), ct);
        var preAguardando = await _db.PreAdmissoes.AsNoTracking()
            .CountAsync(p => p.Status == PreAdmissaoStatus.Preenchido, ct);
        var preAprovadasMes = await _db.PreAdmissoes.AsNoTracking()
            .CountAsync(p => p.Status == PreAdmissaoStatus.Aprovada
                             && p.ApprovedAtUtc.HasValue && p.ApprovedAtUtc >= inicioMes, ct);

        var preRecentes = await _db.PreAdmissoes.AsNoTracking()
            .OrderByDescending(p => p.UpdatedAtUtc)
            .Take(5)
            .Select(p => new { p.Id, p.Nome, p.Status, p.UpdatedAtUtc, p.WizardCompletionPercent })
            .ToListAsync(ct);

        var preRecentesItens = preRecentes
            .Select(p => new DashboardRhPreAdmissaoItem(
                p.Id, p.Nome, p.Status.ToString(), p.UpdatedAtUtc, p.WizardCompletionPercent))
            .ToList();

        // Admissões: funcionários ativos criados na semana/mês.
        var admissoesSemana = await _db.Funcionarios.AsNoTracking()
            .CountAsync(f => f.Status == FuncionarioStatus.Active && f.CreatedAtUtc >= inicioSemana, ct);
        var admissoesMes = await _db.Funcionarios.AsNoTracking()
            .CountAsync(f => f.Status == FuncionarioStatus.Active && f.CreatedAtUtc >= inicioMes, ct);

        // Saúde das notificações (últimos 7 dias) e atividade de matching (últimas 48h).
        var notificacoesFalhadas = await _db.NotificacoesCandidaturaLogs.AsNoTracking()
            .CountAsync(n => n.Status == NotificacaoStatus.Falhou && n.CriadoEmUtc >= inicioSemana, ct);

        var matchingRecente = await _db.CandidatoVagaMatchingScores.AsNoTracking()
            .CountAsync(s => s.CalculatedAtUtc >= horas48, ct);

        var aprovacoesFaixaPendentes = await _db.AprovacoesFaixaSalarial.AsNoTracking()
            .CountAsync(a => a.Status == StatusAprovacaoFaixa.Pendente, ct);

        var solicitacoesVagaPendentes = await _db.SolicitacoesVaga.AsNoTracking()
            .CountAsync(s => s.Status == SolicitacaoStatus.PendenteAprovacao
                             || s.Status == SolicitacaoStatus.PendenteAprovacaoRh, ct);

        return new DashboardRhSection(
            VagasAbertas: vagasAbertas,
            VagasForaSla: vagasForaSla,
            VagasRascunho: vagasRascunho,
            PipelineAplicadas: Etapa(EtapaMacroCandidatura.Aplicada),
            PipelineEmTriagem: Etapa(EtapaMacroCandidatura.EmTriagem),
            PipelineEntrevista: Etapa(EtapaMacroCandidatura.Entrevista) + Etapa(EtapaMacroCandidatura.EntrevistaTecnica),
            PipelineProposta: Etapa(EtapaMacroCandidatura.Proposta),
            PipelineContratadoMes: contratadosMes,
            PreAdmissoesEmAndamento: preEmAndamento,
            PreAdmissoesAguardandoAprovacao: preAguardando,
            PreAdmissoesAprovadasMes: preAprovadasMes,
            AdmissoesSemana: admissoesSemana,
            AdmissoesMes: admissoesMes,
            NotificacoesFalhadas7d: notificacoesFalhadas,
            MatchingScoresUltimas48h: matchingRecente,
            AprovacoesFaixaPendentes: aprovacoesFaixaPendentes,
            SolicitacoesVagaPendentes: solicitacoesVagaPendentes,
            VagasForaSlaTop: foraSlaTop,
            PreAdmissoesRecentes: preRecentesItens);
    }

    // ── Onda 3 — Diretor ──────────────────────────────────────────────────────

    public async Task<DashboardDiretorSection> ParaDiretorAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var inicioMes = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

        // Headcount total + dados incompletos (indicador de qualidade da base TOTVS).
        var headcountTotal = await _db.Funcionarios.AsNoTracking()
            .CountAsync(f => f.Status == FuncionarioStatus.Active, ct);
        var headcountIncompleto = await _db.Funcionarios.AsNoTracking()
            .CountAsync(f => f.Status == FuncionarioStatus.Active && f.HasIncompleteData, ct);

        // Movimentação do mês.
        var admissoesMes = await _db.Funcionarios.AsNoTracking()
            .CountAsync(f => f.Status == FuncionarioStatus.Active && f.CreatedAtUtc >= inicioMes, ct);

        var desligamentosConcluidos = await _db.SolicitacoesDesligamento.AsNoTracking()
            .CountAsync(s => s.Status == SolicitacaoStatus.Concluida
                             && s.UpdatedAtUtc >= inicioMes, ct);
        var desligamentosEmIntegracao = await _db.SolicitacoesDesligamento.AsNoTracking()
            .CountAsync(s => s.Status == SolicitacaoStatus.EmIntegracao, ct);

        var vagasAprovadasMes = await _db.SolicitacoesVaga.AsNoTracking()
            .CountAsync(s => s.Status == SolicitacaoStatus.Aprovada
                             && s.ApprovedAtUtc.HasValue && s.ApprovedAtUtc >= inicioMes, ct);
        var solicitacoesVagaPendentes = await _db.SolicitacoesVaga.AsNoTracking()
            .CountAsync(s => s.Status == SolicitacaoStatus.PendenteAprovacao
                             || s.Status == SolicitacaoStatus.PendenteAprovacaoRh, ct);

        var alcadaAprovadaMes = await _db.Vagas.AsNoTracking()
            .CountAsync(v => v.AlcadaSalarialAprovadaEmUtc.HasValue
                             && v.AlcadaSalarialAprovadaEmUtc >= inicioMes, ct);

        // Ciclos e calibragem.
        var ciclosAbertos = await _db.AvaliacaoCiclos.AsNoTracking()
            .CountAsync(c => c.Status == AvaliacaoCicloStatus.Aberto, ct);
        var ciclosCalibragem = await _db.AvaliacaoCiclos.AsNoTracking()
            .CountAsync(c => c.Status == AvaliacaoCicloStatus.EmCalibragem, ct);
        var convitesPendentes = await _db.AvaliacaoConvites.AsNoTracking()
            .CountAsync(c => c.Status == AvaliacaoConviteStatus.Pendente, ct);

        // Consolidação por centro de custo — absorveu Area em 31.2 (top 8 para não explodir UI).
        var headcountPorCc = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active)
            .GroupBy(f => f.CentroCustoId)
            .Select(g => new { CentroCustoId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var ccsAtivos = headcountPorCc
            .Where(x => x.CentroCustoId.HasValue)
            .Select(x => x.CentroCustoId!.Value)
            .ToList();

        var vagasAbertasPorCc = await _db.Vagas.AsNoTracking()
            .Where(v => v.Status == VagaStatus.Aberta && !v.IsEstrutural && v.CentroCustoId.HasValue)
            .GroupBy(v => v.CentroCustoId!.Value)
            .Select(g => new { CentroCustoId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var vagasLookup = vagasAbertasPorCc.ToDictionary(x => x.CentroCustoId, x => x.Count);

        var ccsNomes = await _db.CentrosCusto.AsNoTracking()
            .Where(cc => ccsAtivos.Contains(cc.Id))
            .Select(cc => new { cc.Id, cc.Description })
            .ToListAsync(ct);
        var ccNomeLookup = ccsNomes.ToDictionary(cc => cc.Id, cc => cc.Description);

        var areasConsolidadas = headcountPorCc
            .Select(x => new DashboardDiretorAreaItem(
                x.CentroCustoId,
                x.CentroCustoId.HasValue && ccNomeLookup.TryGetValue(x.CentroCustoId.Value, out var nome)
                    ? nome
                    : "(sem centro de custo)",
                x.Count,
                x.CentroCustoId.HasValue && vagasLookup.TryGetValue(x.CentroCustoId.Value, out var vq) ? vq : 0))
            .OrderByDescending(a => a.Headcount)
            .Take(8)
            .ToList();

        // Resumo dos últimos 5 ciclos (Aberto + Calibragem + Fechado recentes).
        var ciclosRecentes = await _db.AvaliacaoCiclos.AsNoTracking()
            .OrderByDescending(c => c.AtualizadoEmUtc)
            .Take(5)
            .Select(c => new { c.Id, c.Nome, c.Periodo, c.Status })
            .ToListAsync(ct);

        var ciclosIds = ciclosRecentes.Select(c => c.Id).ToList();
        var convitesPorCiclo = await _db.AvaliacaoConvites.AsNoTracking()
            .Where(c => ciclosIds.Contains(c.CicloId))
            .GroupBy(c => new { c.CicloId, c.Status })
            .Select(g => new { g.Key.CicloId, g.Key.Status, Count = g.Count() })
            .ToListAsync(ct);

        var ciclosResumo = ciclosRecentes
            .Select(c =>
            {
                var linhas = convitesPorCiclo.Where(x => x.CicloId == c.Id).ToList();
                var total = linhas.Sum(x => x.Count);
                var respondidos = linhas
                    .Where(x => x.Status == AvaliacaoConviteStatus.Respondido)
                    .Sum(x => x.Count);
                return new DashboardDiretorCicloItem(
                    c.Id, c.Nome, c.Periodo, c.Status.ToString(),
                    total, respondidos);
            })
            .ToList();

        return new DashboardDiretorSection(
            HeadcountTotal: headcountTotal,
            HeadcountComDadosIncompletos: headcountIncompleto,
            AdmissoesMes: admissoesMes,
            DesligamentosConcluidosMes: desligamentosConcluidos,
            DesligamentosAguardandoIntegracaoMes: desligamentosEmIntegracao,
            VagasAprovadasMes: vagasAprovadasMes,
            SolicitacoesVagaPendentes: solicitacoesVagaPendentes,
            AlcadaSalarialAprovadaMes: alcadaAprovadaMes,
            CiclosAvaliacaoAbertos: ciclosAbertos,
            CiclosAvaliacaoEmCalibragem: ciclosCalibragem,
            ConvitesAvaliacaoPendentes: convitesPendentes,
            HeadcountPorArea: areasConsolidadas,
            CiclosResumo: ciclosResumo);
    }

    private static bool OwnerMatches(string? owner, IReadOnlyList<string> ownerTokens)
    {
        if (string.IsNullOrWhiteSpace(owner) || ownerTokens.Count == 0)
            return false;

        var normalizedOwner = NormalizeForComparison(owner);
        return ownerTokens.Any(token => normalizedOwner.Contains(token, StringComparison.OrdinalIgnoreCase));
    }

    private static bool ParticipantMatches(string? notes, IReadOnlyList<string> ownerTokens)
    {
        if (string.IsNullOrWhiteSpace(notes) || ownerTokens.Count == 0)
            return false;

        var participantLine = notes
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(line => line.StartsWith("Participantes opcionais:", StringComparison.OrdinalIgnoreCase));

        if (string.IsNullOrWhiteSpace(participantLine))
            return false;

        var normalizedParticipants = NormalizeForComparison(participantLine);
        return ownerTokens.Any(token => normalizedParticipants.Contains(token, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeForComparison(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                builder.Append(ch);
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private async Task<(int Count, int Posicoes)> ObterRequisicoesPessoalAtivasGestorAsync(
        Guid funcionarioId,
        CancellationToken ct)
    {
        var statusAtivos = SolicitacaoVagaStatusRules.StatusAtivos;

        var query = _db.SolicitacoesVaga.AsNoTracking()
            .Where(s => s.SolicitanteId == funcionarioId && statusAtivos.Contains(s.Status));

        var requisicoesOrigemRmAtiva = await _db.TenantConfiguracoes
            .AsNoTracking()
            .Select(c => c.RequisicoesVagaOrigemRm)
            .FirstOrDefaultAsync(ct);

        if (requisicoesOrigemRmAtiva)
        {
            query = query.Where(s =>
                s.RmRequisicaoCodigo != null
                && s.RmRequisicaoCodigo != ""
                && !s.RmRequisicaoCodigo.StartsWith("STUB-")
                && s.RmCriacaoSolicitadaEmUtc == null);
        }

        var posicoes = await query
            .Select(s => s.QtdPosicoes)
            .ToListAsync(ct);

        return (posicoes.Count, posicoes.Sum());
    }
}
