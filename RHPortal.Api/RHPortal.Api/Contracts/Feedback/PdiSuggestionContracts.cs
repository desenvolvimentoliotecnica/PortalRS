namespace RhPortal.Api.Contracts.Feedback;

// ── Sugestão automática de PDI (Entrega 1.4 — Fase 1 Paridade Feedz) ──

/// <summary>Meta SMART sugerida para o PDI a partir de gaps da avaliação.</summary>
public sealed record PdiSuggestedGoal(
    string Description,
    DateTimeOffset? DueDate,
    int Order,
    /// <summary>Texto curto explicando POR QUE essa meta foi sugerida (gap da avaliação, perfil do cargo).</summary>
    string? Justification);

/// <summary>Resultado da sugestão de PDI — preview (não persistido).</summary>
public sealed record PdiSuggestionResult(
    Guid FuncionarioId,
    string FuncionarioNome,
    string? Cargo,
    Guid CicloId,
    string CicloNome,
    string Title,
    string Description,
    List<PdiSuggestedGoal> Goals,
    /// <summary>Origem: "ai" se IA gerou, "heuristic" se fallback determinístico.</summary>
    string Source,
    /// <summary>Score médio do funcionário no ciclo (informativo).</summary>
    decimal? ScoreMedio,
    /// <summary>Nome do modelo de IA usado, quando aplicável.</summary>
    string? AiModel);

/// <summary>Cria DevelopmentPlan + Goals a partir de uma sugestão (após o gestor revisar/editar).</summary>
public sealed record PdiCreateFromSuggestionRequest(
    Guid TargetUserId,
    string Title,
    string? Description,
    List<PdiSuggestedGoal> Goals);
