using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de férias feita pelo colaborador, aprovada pelo gestor direto e RH.
/// Segue regras CLT: período aquisitivo, fracionamento (min 14 dias), abono pecuniário (max 1/3).
/// </summary>
public sealed class SolicitacaoFerias : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante ──

    /// <summary>Colaborador que solicita férias.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    // ── Dados das férias ──

    /// <summary>Período aquisitivo de referência (ex: "2025/2026").</summary>
    public string? PeriodoAquisitivo { get; set; }

    public DateOnly DataInicio { get; set; }
    public DateOnly DataFim { get; set; }

    /// <summary>Quantidade de dias de férias (calculado: DataFim - DataInicio + 1).</summary>
    public int QtdDias { get; set; }

    /// <summary>Se true, o colaborador deseja vender parte das férias (abono pecuniário — máx 1/3 = 10 dias).</summary>
    public bool AbonoPecuniario { get; set; }

    /// <summary>Dias a converter em abono (máx 10).</summary>
    public int DiasAbono { get; set; }

    /// <summary>Se true, solicita adiantamento da 1ª parcela do 13º salário.</summary>
    public bool Adiantamento13 { get; set; }

    // ── Status e Aprovação ──

    public SolicitacaoStatus Status { get; set; } = SolicitacaoStatus.Rascunho;

    public string? ObservacaoAprovador { get; set; }
    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── Integração TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }
}
