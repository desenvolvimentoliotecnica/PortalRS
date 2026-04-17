using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitacao de pagamento extra (bonus, comissao, PLR, hora extra, etc.).
/// Segue o mesmo fluxo de aprovacao das demais solicitacoes.
/// </summary>
public sealed class SolicitacaoPagamentoExtra : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante e Funcionario ──

    /// <summary>Colaborador que abre a solicitacao.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

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

    // ── Status e Aprovacao ──

    public SolicitacaoStatus Status { get; set; } = SolicitacaoStatus.Rascunho;

    public Guid? Aprovador1Id { get; set; }
    public Funcionario? Aprovador1 { get; set; }
    public StatusAprovacao Aprovador1Status { get; set; } = StatusAprovacao.Pendente;
    public DateTimeOffset? Aprovador1DataUtc { get; set; }

    public Guid? Aprovador2Id { get; set; }
    public Funcionario? Aprovador2 { get; set; }
    public StatusAprovacao? Aprovador2Status { get; set; }
    public DateTimeOffset? Aprovador2DataUtc { get; set; }
    public bool Aprovador2Habilitado { get; set; }

    public string? ObservacaoAprovador { get; set; }
    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── Integracao TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }

    public int TentativasIntegracao { get; set; }
    public DateTimeOffset? UltimaTentativaUtc { get; set; }
}
