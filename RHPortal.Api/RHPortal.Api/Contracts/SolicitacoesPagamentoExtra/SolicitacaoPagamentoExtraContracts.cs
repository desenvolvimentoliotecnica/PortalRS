using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesPagamentoExtra;

public sealed record SolicitacaoPagamentoExtraListQuery(string? Q, SolicitacaoStatus? Status, bool? ApenasMeus, int? Page, int? PageSize);

public sealed class SolicitacaoPagamentoExtraCreateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    public TipoPagamentoExtra TipoPagamentoExtra { get; set; }

    [Required]
    public decimal Valor { get; set; }

    [Required, MaxLength(500)]
    public string Descricao { get; set; } = string.Empty;

    [Required]
    public DateOnly DataPagamento { get; set; }

    [MaxLength(7)]
    public string? Competencia { get; set; }

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class SolicitacaoPagamentoExtraUpdateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    public TipoPagamentoExtra TipoPagamentoExtra { get; set; }

    [Required]
    public decimal Valor { get; set; }

    [Required, MaxLength(500)]
    public string Descricao { get; set; } = string.Empty;

    [Required]
    public DateOnly DataPagamento { get; set; }

    [MaxLength(7)]
    public string? Competencia { get; set; }

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class SolicitacaoPagamentoExtraApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed record SolicitacaoPagamentoExtraResponse(
    Guid Id, SolicitacaoStatus Status,
    Guid SolicitanteId, string? SolicitanteNome,
    Guid FuncionarioId, string? FuncionarioNome,
    TipoPagamentoExtra TipoPagamentoExtra, decimal Valor,
    string Descricao, DateOnly DataPagamento, string? Competencia,
    Guid? Aprovador1Id, string? Aprovador1Nome, StatusAprovacao Aprovador1Status, DateTimeOffset? Aprovador1DataUtc,
    Guid? Aprovador2Id, string? Aprovador2Nome, StatusAprovacao? Aprovador2Status, DateTimeOffset? Aprovador2DataUtc,
    bool Aprovador2Habilitado,
    string? ObservacaoAprovador, string? Observacoes,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado, string? IntegracaoMensagem, DateTimeOffset? IntegradaEmUtc
);

public sealed record SolicitacaoPagamentoExtraGridRow(
    Guid Id, SolicitacaoStatus Status, string? SolicitanteNome,
    string? FuncionarioNome, TipoPagamentoExtra TipoPagamentoExtra,
    decimal Valor, DateOnly DataPagamento,
    DateTimeOffset CreatedAtUtc
);
