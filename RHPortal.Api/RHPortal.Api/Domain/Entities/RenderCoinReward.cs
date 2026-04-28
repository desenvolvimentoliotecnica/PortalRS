namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Recompensa do catálogo Render Coins (Entrega 1.8 — Fase 1 Paridade Feedz).
/// Colaborador troca o saldo da gamificação por algo concreto: voucher, day-off,
/// curso, doação. Fecha a alça da gamificação que existia parcial (ganho sem destino).
/// </summary>
public sealed class RenderCoinReward : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Codigo { get; set; } = default!;
    public string Nome { get; set; } = default!;
    public string? Descricao { get; set; }

    /// <summary>Categoria livre — "Voucher", "Bem-estar", "Carreira", "Solidariedade", etc.</summary>
    public string? Categoria { get; set; }

    public decimal CustoCoins { get; set; }

    /// <summary>
    /// Estoque disponível. Null = ilimitado. 0 = esgotado. Decremento atômico no resgate.
    /// </summary>
    public int? EstoqueDisponivel { get; set; }

    public string? ImagemUrl { get; set; }

    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public int Ordem { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }

    public ICollection<RenderCoinRedemption> Redemptions { get; set; } = new List<RenderCoinRedemption>();
}

/// <summary>
/// Pedido de resgate de uma <see cref="RenderCoinReward"/>.
/// Workflow: Solicitado → Aprovado → Entregue (ou Cancelado a qualquer momento).
/// </summary>
public sealed class RenderCoinRedemption : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid RewardId { get; set; }
    public RenderCoinReward? Reward { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    /// <summary>Valor em coins gasto no momento do resgate (snapshot — preserva mesmo se Reward.Custo mudar depois).</summary>
    public decimal CoinsGastos { get; set; }

    /// <summary>0=Solicitado, 1=Aprovado, 2=Entregue, 3=Cancelado.</summary>
    public int Status { get; set; }

    public string? Observacao { get; set; }

    /// <summary>Quem aprovou/processou (null enquanto Solicitado).</summary>
    public Guid? ProcessadoPorUserId { get; set; }
    public DateTimeOffset? ProcessadoEmUtc { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
}
