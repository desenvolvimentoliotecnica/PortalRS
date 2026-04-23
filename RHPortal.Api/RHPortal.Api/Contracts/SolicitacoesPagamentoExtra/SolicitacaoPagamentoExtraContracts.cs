using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Contracts.Common;
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

    /// <summary>Preenchido pelo ImportarAsync para rastrear quem importou em lote.</summary>
    public Guid? ImportadoPorId { get; set; }
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
    Guid? SolicitanteId, string? SolicitanteNome,
    Guid? ImportadoPorId, string? ImportadoPorNome, DateTimeOffset? ImportadaEmUtc,
    Guid FuncionarioId, string? FuncionarioNome,
    TipoPagamentoExtra TipoPagamentoExtra, decimal Valor,
    string Descricao, DateOnly DataPagamento, string? Competencia,
    string? Observacoes,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado, string? IntegracaoMensagem, DateTimeOffset? IntegradaEmUtc,
    IReadOnlyList<EtapaAprovacaoResponse> Etapas
);

public sealed record SolicitacaoPagamentoExtraGridRow(
    Guid Id, SolicitacaoStatus Status, string? SolicitanteNome,
    string? FuncionarioNome, TipoPagamentoExtra TipoPagamentoExtra,
    decimal Valor, DateOnly DataPagamento,
    DateTimeOffset CreatedAtUtc
);

public sealed class ImportacaoPagamentoExtraConfirmarLinhaRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    [Required]
    public decimal Valor { get; set; }
}

public sealed class ImportacaoPagamentoExtraConfirmarRequest
{
    [Required]
    public TipoPagamentoExtra TipoPagamentoExtra { get; set; }

    [Required, MaxLength(500)]
    public string Descricao { get; set; } = string.Empty;

    [Required]
    public DateOnly DataPagamento { get; set; }

    [MaxLength(7)]
    public string? Competencia { get; set; }

    [MaxLength(2000)]
    public string? Observacoes { get; set; }

    [Required]
    public List<ImportacaoPagamentoExtraConfirmarLinhaRequest> Linhas { get; set; } = [];
}

public sealed record ImportacaoPagamentoExtraConfirmarItemResponse(
    Guid FuncionarioId,
    string? FuncionarioNome,
    Guid? SolicitacaoId,
    string? Erro
);

public sealed record ImportacaoPagamentoExtraConfirmarResponse(
    int TotalLinhas,
    int Criados,
    int Falhas,
    IReadOnlyList<ImportacaoPagamentoExtraConfirmarItemResponse> Itens
);

public sealed record ImportacaoPagamentoExtraLinhaPreview(
    int Linha,
    string Empresa,
    string Estabelecimento,
    string Matricula,
    string NomePlanilha,
    string CargoPlanilha,
    string CentroCustoPlanilha,
    decimal? Valor,
    decimal? PercentualDsr,
    decimal? ValorDsr,
    decimal? TotalReceber,
    Guid? FuncionarioId,
    string? FuncionarioNome,
    string? Erro
);

public sealed record ImportacaoPagamentoExtraPreviewResponse(
    int TotalLinhas,
    int Encontrados,
    int NaoEncontrados,
    IReadOnlyList<ImportacaoPagamentoExtraLinhaPreview> Linhas
);
