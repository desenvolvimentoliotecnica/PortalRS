namespace RhPortal.Api.Contracts.Feedback;

// ── Catálogo Render Coins (Entrega 1.8 — Fase 1 Paridade Feedz) ──

public sealed record RenderCoinRewardResponse(
    Guid Id,
    string Codigo,
    string Nome,
    string? Descricao,
    string? Categoria,
    decimal CustoCoins,
    int? EstoqueDisponivel,
    string? ImagemUrl,
    bool IsSystem,
    bool IsActive,
    int Ordem,
    DateTimeOffset CriadoEmUtc
);

public sealed record RenderCoinRewardCreateRequest(
    string Codigo,
    string Nome,
    decimal CustoCoins,
    string? Descricao = null,
    string? Categoria = null,
    int? EstoqueDisponivel = null,
    string? ImagemUrl = null
);

public sealed record RenderCoinRedeemRequest(
    Guid RewardId,
    string? Observacao = null
);

public sealed record RenderCoinRedemptionResponse(
    Guid Id,
    Guid RewardId,
    string RewardNome,
    Guid UserId,
    string UserNome,
    decimal CoinsGastos,
    int Status,
    string StatusNome,
    string? Observacao,
    Guid? ProcessadoPorUserId,
    string? ProcessadoPorNome,
    DateTimeOffset? ProcessadoEmUtc,
    DateTimeOffset CriadoEmUtc
);

public sealed record RenderCoinRedemptionStatusUpdateRequest(
    int NovoStatus, // 1=Aprovado, 2=Entregue, 3=Cancelado
    string? Observacao = null
);
