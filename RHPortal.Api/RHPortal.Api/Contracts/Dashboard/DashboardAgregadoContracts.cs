namespace RhPortal.Api.Contracts.Dashboard;

/// <summary>
/// Resposta do endpoint agregado /api/dashboard/agregado?perfil=... (Sessão 31).
///
/// Contrato único para as três ondas (gestor, rh, diretor). Quando o usuário pede
/// um perfil para o qual o backend não tem dados a mostrar (ex.: gestor sem
/// FuncionarioId vinculado, ou diretor em tenant sem módulo de desempenho), a
/// seção correspondente vem null — o frontend trata como "perfil indisponível"
/// em vez de 403. Permissão única: dashboard.view.
/// </summary>
public sealed record DashboardAgregadoResponse(
    string Perfil,
    DateTimeOffset GeradoEmUtc,
    Guid? FuncionarioId,
    DashboardGestorSection? Gestor,
    DashboardRhSection? Rh,
    DashboardDiretorSection? Diretor
);

// ─────────────────────────────────────────────────────────────────────────────
// Onda 1 — Gestor
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Visão do gestor direto: foco no próprio time (subordinados diretos via
/// Funcionario.GestorDiretoId) e nas vagas/solicitações que dependem dele.
/// </summary>
public sealed record DashboardGestorSection(
    int DiretosAtivos,
    int DiretosComDadosIncompletos,
    int CarteiraVagasAbertas,
    int CarteiraVagasParadas, // fora do SLA
    int CarteiraCandidaturasAtivas,
    int CandidaturasEtapaAvancada, // Entrevista + Teste + Proposta
    int AprovacoesPendentesMinhas, // SolicitacaoAprovacaoEtapa aonde eu sou aprovador
    int SolicitacoesEquipePendentes, // solicitações da minha equipe (diretos) em aberto
    int AvaliacoesDiretosPendentes, // AvaliacaoConvite onde EU sou o avaliador
    IReadOnlyList<DashboardGestorVagaAbertaItem> VagasMaisAntigas,
    IReadOnlyList<DashboardGestorCandidaturaItem> CandidaturasEmDestaque,
    IReadOnlyList<DashboardGestorAgendaTecnicaItem> AgendaTecnicaProxima
);

public sealed record DashboardGestorVagaAbertaItem(
    Guid VagaId,
    string? Codigo,
    string Titulo,
    int DiasAberta,
    bool ForaDoSla,
    int Candidaturas
);

public sealed record DashboardGestorCandidaturaItem(
    Guid CandidaturaId,
    Guid VagaId,
    string? VagaTitulo,
    Guid CandidatoId,
    string CandidatoNome,
    string EtapaMacro,
    int? DiasNaEtapa
);

public sealed record DashboardGestorAgendaTecnicaItem(
    Guid EventoId,
    Guid? CandidaturaId,
    Guid? CandidatoId,
    Guid? VagaId,
    string Titulo,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string Status,
    string? Location,
    string? Owner,
    string? Candidate,
    string? VagaTitle,
    string? VagaCode,
    string? CandidateResponseStatus,
    string TypeCode,
    string TypeLabel
);

// ─────────────────────────────────────────────────────────────────────────────
// Onda 2 — RH / Recrutador
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Visão do RH/recrutador: operação do funil de recrutamento + admissões em
/// curso + saúde das notificações automáticas.
/// </summary>
public sealed record DashboardRhSection(
    int VagasAbertas,
    int VagasForaSla,
    int VagasRascunho,
    int PipelineAplicadas,
    int PipelineEmTriagem,
    int PipelineEntrevista,
    int PipelineProposta,
    int PipelineContratadoMes,
    int PreAdmissoesEmAndamento, // Enviado + Acessado + Preenchido + PreenchidoParcial
    int PreAdmissoesAguardandoAprovacao, // Preenchido
    int PreAdmissoesAprovadasMes,
    int AdmissoesSemana,
    int AdmissoesMes,
    int NotificacoesFalhadas7d,
    int MatchingScoresUltimas48h,
    int AprovacoesFaixaPendentes,
    int SolicitacoesVagaPendentes,
    IReadOnlyList<DashboardRhVagaForaSlaItem> VagasForaSlaTop,
    IReadOnlyList<DashboardRhPreAdmissaoItem> PreAdmissoesRecentes
);

public sealed record DashboardRhVagaForaSlaItem(
    Guid VagaId,
    string? Codigo,
    string Titulo,
    string? Area,
    int DiasAberta,
    int MetaSlaDias
);

public sealed record DashboardRhPreAdmissaoItem(
    Guid PreAdmissaoId,
    string Nome,
    string Status,
    DateTimeOffset UpdatedAtUtc,
    int? CompletionPercent
);

// ─────────────────────────────────────────────────────────────────────────────
// Onda 3 — Diretor
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Visão do diretor: números consolidados por área (headcount, movimentação,
/// alçada, saúde dos ciclos de avaliação). Não existe hierarquia explícita de
/// "diretor" no schema; a visão é do tenant inteiro — o gate é a permissão
/// dashboard.view combinada com uma role gerencial (validada no frontend via
/// ICurrentUserContext).
/// </summary>
public sealed record DashboardDiretorSection(
    int HeadcountTotal,
    int HeadcountComDadosIncompletos,
    int AdmissoesMes,
    int DesligamentosConcluidosMes,
    int DesligamentosAguardandoIntegracaoMes,
    int VagasAprovadasMes,
    int SolicitacoesVagaPendentes,
    int AlcadaSalarialAprovadaMes,
    int CiclosAvaliacaoAbertos,
    int CiclosAvaliacaoEmCalibragem,
    int ConvitesAvaliacaoPendentes,
    IReadOnlyList<DashboardDiretorAreaItem> HeadcountPorArea,
    IReadOnlyList<DashboardDiretorCicloItem> CiclosResumo
);

public sealed record DashboardDiretorAreaItem(
    Guid? AreaId,
    string AreaNome,
    int Headcount,
    int VagasAbertas
);

public sealed record DashboardDiretorCicloItem(
    Guid CicloId,
    string Nome,
    string Periodo,
    string Status,
    int ConvitesTotal,
    int ConvitesRespondidos
);
