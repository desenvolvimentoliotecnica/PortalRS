namespace RhPortal.Api.Contracts.Feedback;

// ── Templates de Feedback (Entrega 1.3 — Fase 1 Paridade Feedz) ──

public sealed record FeedbackTemplateResponse(
    Guid Id,
    string Codigo,
    string Nome,
    string? Descricao,
    string? Categoria,
    string Conteudo,
    string? TipoSugerido,
    bool IsSystem,
    bool IsActive,
    int Ordem,
    DateTimeOffset CriadoEmUtc
);

public sealed record FeedbackTemplateCreateRequest(
    string Codigo,
    string Nome,
    string Conteudo,
    string? Descricao = null,
    string? Categoria = null,
    string? TipoSugerido = null
);
