namespace RhPortal.Api.Contracts.Avaliacao;

// ── Templates de Avaliação (Entrega 1.1 — Fase 1 Paridade Feedz) ──

/// <summary>Pergunta pré-pronta dentro de um template de avaliação.</summary>
public sealed record AvaliacaoTemplatePerguntaResponse(Guid Id, string Texto, int Ordem);

/// <summary>Template de avaliação visível no catálogo.</summary>
public sealed record AvaliacaoTemplateResponse(
    Guid Id,
    string Codigo,
    string Nome,
    string? Descricao,
    string? PeriodoSugerido,
    bool IsSystem,
    bool IsActive,
    int Ordem,
    int TotalPerguntas,
    DateTimeOffset CriadoEmUtc,
    List<AvaliacaoTemplatePerguntaResponse> Perguntas
);

/// <summary>
/// Cria um ciclo a partir de um template existente.
/// O <see cref="Periodo"/> e o <see cref="Nome"/> ainda são editáveis pelo usuário antes de salvar
/// (a UI pré-popula com o nome do template + período sugerido).
/// </summary>
public sealed record AvaliacaoCicloFromTemplateRequest(
    Guid TemplateId,
    string Nome,
    string Periodo,
    string? Descricao = null,
    DateOnly? DataInicio = null,
    DateOnly? DataFim = null,
    bool IniciarEmRascunho = false
);

/// <summary>Cria template customizado pelo tenant (template não-sistema).</summary>
public sealed record AvaliacaoTemplateCreateRequest(
    string Codigo,
    string Nome,
    List<string> Perguntas,
    string? Descricao = null,
    string? PeriodoSugerido = null
);
