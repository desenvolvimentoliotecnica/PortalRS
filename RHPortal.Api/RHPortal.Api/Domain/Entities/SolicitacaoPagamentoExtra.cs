using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitacao de pagamento extra (bonus, comissao, PLR, hora extra, etc.).
/// Fluxo de aprovacao: Gestor Direto → Revisão RH → Integração TOTVS (via etapas dinâmicas).
/// </summary>
public sealed class SolicitacaoPagamentoExtra : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante e Funcionario ──

    /// <summary>Colaborador que abre a solicitacao (pode ser o RH que importou). Nulo quando criado por admin sem Funcionario vinculado.</summary>
    public Guid? SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    /// <summary>Funcionario que realizou a importacao em lote (nulo = criacao manual).</summary>
    public Guid? ImportadoPorId { get; set; }
    public Funcionario? ImportadoPor { get; set; }

    /// <summary>Data/hora em que a importacao em lote foi realizada.</summary>
    public DateTimeOffset? ImportadaEmUtc { get; set; }

    /// <summary>Funcionario beneficiario do pagamento extra.</summary>
    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    // ── Dados do pagamento ──

    public TipoPagamentoExtra TipoPagamentoExtra { get; set; }

    /// <summary>Valor monetario do pagamento extra.</summary>
    public decimal Valor { get; set; }

    [MaxLength(500)]
    public string Descricao { get; set; } = string.Empty;

    /// <summary>Data prevista para o pagamento.</summary>
    public DateOnly DataPagamento { get; set; }

    /// <summary>Competencia de referencia (ex: "2026/03"). Opcional.</summary>
    [MaxLength(7)]
    public string? Competencia { get; set; }

    [MaxLength(2000)]
    public string? Observacoes { get; set; }

    // ── Status ──

    public SolicitacaoStatus Status { get; set; } = SolicitacaoStatus.Rascunho;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── Integracao TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }

    public Guid? EfetivadoManualmentePorId { get; set; }
    public DateTimeOffset? EfetivadoManualmenteEmUtc { get; set; }

    public int TentativasIntegracao { get; set; }
    public DateTimeOffset? UltimaTentativaUtc { get; set; }
}
