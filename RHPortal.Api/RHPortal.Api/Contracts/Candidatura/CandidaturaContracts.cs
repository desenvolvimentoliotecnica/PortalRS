using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Candidatura;

/// <summary>Resumo server-side de uma candidatura (para o portal externo).</summary>
public sealed record CandidaturaResponse(
    Guid Id,
    Guid CandidatoId,
    Guid VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    string? VagaLocal,
    CandidaturaStatus Status,
    EtapaMacroCandidatura EtapaMacro,
    DateTimeOffset AplicadaEmUtc,
    DateTimeOffset? EtapaAtualDesdeUtc,
    DateTimeOffset UpdatedAtUtc,
    IReadOnlyList<CandidaturaEtapaHistoricoItem> Historico
);

public sealed record CandidaturaEtapaHistoricoItem(
    EtapaMacroCandidatura EtapaAnterior,
    EtapaMacroCandidatura EtapaNova,
    DateTimeOffset EmUtc,
    string? Observacao
);

public sealed record AvancarEtapaRequest(
    EtapaMacroCandidatura NovaEtapa,
    string? Observacao,
    AgendarEntrevistaCandidaturaRequest? Entrevista = null
);

public sealed record AgendarEntrevistaCandidaturaRequest(
    DateTime InicioUtc,
    int DuracaoMinutos,
    string Formato,
    string Responsavel,
    string? Local,
    string? Observacao
);

public sealed record RegistrarObservacaoCandidaturaRequest(
    string Observacao
);

/// <summary>Item leve usado no kanban admin — sem histórico, apenas o essencial para cards.</summary>
public sealed record KanbanCandidaturaItem(
    Guid Id,
    Guid CandidatoId,
    string CandidatoNome,
    string? CandidatoEmail,
    string? CandidatoFone,
    string? CandidatoCelular,
    string? CandidatoAvatarUrl,
    Guid VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    CandidaturaStatus Status,
    EtapaMacroCandidatura EtapaMacro,
    DateTimeOffset AplicadaEmUtc,
    DateTimeOffset? EtapaAtualDesdeUtc,
    int? MatchScore,
    /// <summary>Sessão 31.8 — Dias na etapa atual (ou desde aplicação se etapa inicial). Calculado no servidor.</summary>
    int DiasNaEtapa,
    /// <summary>SLA esperado para a etapa em dias. Default por etapa: Aplicada=2, Triagem=5, Entrevista=10, Teste=7, Proposta=5. Override via Vaga.SlaDiasMetaFechamento (rateio igual entre etapas) ou EixoVaga.</summary>
    int SlaDiasEtapa,
    /// <summary>"verde" (até 50% do SLA) / "amarelo" (50-100%) / "vermelho" (>100%). Pré-calculado para o front não duplicar lógica.</summary>
    string SlaSemaforo
);

/// <summary>
/// Sessão 31.8 (FASE 3.A) — Etapa do funil de conversão de candidaturas.
/// Cada etapa tem total + taxa de conversão para a próxima (% que avançou).
/// </summary>
public sealed record FunilEtapaItem(
    EtapaMacroCandidatura Etapa,
    string Titulo,
    int Total,
    /// <summary>% que avançou para a etapa seguinte. Null para etapas terminais (Contratado/Recusado/Desistiu) ou para a última do funil.</summary>
    decimal? TaxaConversaoPercent
);

public sealed record FunilCandidaturasResponse(
    int TotalGeral,
    Guid? VagaId,
    string? VagaTitulo,
    DateTimeOffset? PeriodoInicioUtc,
    DateTimeOffset? PeriodoFimUtc,
    IReadOnlyList<FunilEtapaItem> Etapas
);

/// <summary>Sessão 31.8 (FASE 3.B) — Request para mover N candidaturas de etapa em massa.</summary>
public sealed record BulkAvancarEtapaRequest(
    IReadOnlyList<Guid> CandidaturaIds,
    EtapaMacroCandidatura NovaEtapa,
    string? Observacao
);

public sealed record BulkAvancarEtapaResponse(
    int Total,
    int Sucesso,
    int Falha,
    IReadOnlyList<BulkAvancarEtapaItemResult> Itens
);

public sealed record BulkAvancarEtapaItemResult(
    Guid CandidaturaId,
    bool Sucesso,
    string? CandidatoNome,
    string? Erro
);

/// <summary>Resposta do kanban: uma coluna por EtapaMacroCandidatura com os candidatos dentro.</summary>
public sealed record KanbanCandidaturasResponse(
    IReadOnlyList<KanbanColunaResponse> Colunas,
    int Total
);

public sealed record KanbanVagaFiltroItem(
    Guid Id,
    string? Titulo,
    string? Codigo,
    int TotalCandidaturas
);

public sealed record KanbanColunaResponse(
    EtapaMacroCandidatura Etapa,
    string Titulo,
    int Total,
    IReadOnlyList<KanbanCandidaturaItem> Itens
);

// ── Auditoria de logs de notificação ──────────────────────────────────────────

/// <summary>
/// Linha de auditoria de notificação de mudança de etapa — um log por canal (e-mail/WhatsApp)
/// avaliado, incluindo envios pulados por falta de opt-in/destino. Usada pela tela
/// admin <c>/administracao/notificacoes-candidatura</c> e por integrações de monitoramento.
/// </summary>
public sealed record NotificacaoCandidaturaLogItem(
    Guid Id,
    Guid CandidaturaId,
    Guid CandidatoId,
    string? CandidatoNome,
    string? CandidatoEmail,
    string? CandidatoFone,
    Guid? VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    EtapaMacroCandidatura EtapaMacro,
    CanalNotificacao Canal,
    NotificacaoStatus Status,
    string? Destino,
    string? Mensagem,
    string? ErroMensagem,
    DateTimeOffset CriadoEmUtc
);

public sealed record NotificacaoCandidaturaLogsResponse(
    IReadOnlyList<NotificacaoCandidaturaLogItem> Items,
    int Total,
    int Page,
    int PageSize,
    int TotalPages
);

// ── Templates de notificação por (etapa × canal) ──────────────────────────────

/// <summary>
/// Linha da matriz do editor de templates. <c>UsaDefault=true</c> indica que
/// o tenant não tem override e está usando o default hardcoded.
/// </summary>
public sealed record NotificacaoTemplateItem(
    EtapaMacroCandidatura Etapa,
    CanalNotificacao Canal,
    string? Assunto,
    string Corpo,
    bool UsaDefault,
    DateTimeOffset? AtualizadoEmUtc
);

public sealed record NotificacaoTemplateSaveRequest(
    EtapaMacroCandidatura Etapa,
    CanalNotificacao Canal,
    string? Assunto,
    string Corpo
);
