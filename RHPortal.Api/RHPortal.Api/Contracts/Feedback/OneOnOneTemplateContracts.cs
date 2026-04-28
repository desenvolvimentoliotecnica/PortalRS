namespace RhPortal.Api.Contracts.Feedback;

// ── Templates de 1:1 (Entrega 1.2 — Fase 1 Paridade Feedz) ──

/// <summary>Item/tópico de pauta dentro de um template de 1:1.</summary>
public sealed record OneOnOneTemplateItemResponse(Guid Id, string Texto, int Ordem);

/// <summary>Template de pauta 1:1 visível no catálogo.</summary>
public sealed record OneOnOneTemplateResponse(
    Guid Id,
    string Codigo,
    string Nome,
    string? Descricao,
    string? Categoria,
    bool IsSystem,
    bool IsActive,
    int Ordem,
    int TotalItens,
    DateTimeOffset CriadoEmUtc,
    List<OneOnOneTemplateItemResponse> Itens
);

/// <summary>Cria template customizado pelo tenant (não-sistema).</summary>
public sealed record OneOnOneTemplateCreateRequest(
    string Codigo,
    string Nome,
    List<string> Itens,
    string? Descricao = null,
    string? Categoria = null
);
