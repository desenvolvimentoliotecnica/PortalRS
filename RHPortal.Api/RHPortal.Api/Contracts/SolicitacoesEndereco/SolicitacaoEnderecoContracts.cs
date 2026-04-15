using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesEndereco;

public sealed record SolicitacaoEnderecoListQuery(string? Q, SolicitacaoStatus? Status, SolicitacaoStatus[]? Statuses, bool? ApenasMeus, int? Page, int? PageSize);

public sealed class SolicitacaoEnderecoCreateRequest
{
    [Required, MaxLength(9)] public string Cep { get; set; } = string.Empty;
    [Required, MaxLength(300)] public string Logradouro { get; set; } = string.Empty;
    [MaxLength(20)] public string? Numero { get; set; }
    [MaxLength(100)] public string? Bairro { get; set; }
    [MaxLength(100)] public string? Complemento { get; set; }
    [Required, MaxLength(100)] public string Cidade { get; set; } = string.Empty;
    [Required, MaxLength(2)] public string Uf { get; set; } = string.Empty;
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed class SolicitacaoEnderecoUpdateRequest
{
    [Required, MaxLength(9)] public string Cep { get; set; } = string.Empty;
    [Required, MaxLength(300)] public string Logradouro { get; set; } = string.Empty;
    [MaxLength(20)] public string? Numero { get; set; }
    [MaxLength(100)] public string? Bairro { get; set; }
    [MaxLength(100)] public string? Complemento { get; set; }
    [Required, MaxLength(100)] public string Cidade { get; set; } = string.Empty;
    [Required, MaxLength(2)] public string Uf { get; set; } = string.Empty;
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed record SolicitacaoEnderecoResponse(
    Guid Id, SolicitacaoStatus Status,
    Guid SolicitanteId, string? SolicitanteNome,
    string Cep, string Logradouro, string? Numero, string? Bairro,
    string? Complemento, string Cidade, string Uf,
    string? ObservacaoAprovador, string? Observacoes,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado, string? IntegracaoMensagem, DateTimeOffset? IntegradaEmUtc
);

public sealed class SolicitacaoEnderecoApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed record SolicitacaoEnderecoGridRow(
    Guid Id, SolicitacaoStatus Status, string? SolicitanteNome,
    string Cep, string Cidade, string Uf,
    DateTimeOffset CreatedAtUtc
);
