using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesBeneficio;

public sealed record SolicitacaoBeneficioListQuery(string? Q, SolicitacaoStatus? Status, bool? ApenasMeus, int? Page, int? PageSize);

public sealed class SolicitacaoBeneficioCreateRequest
{
    public TipoBeneficio TipoBeneficio { get; set; }
    public TipoAlteracaoBeneficio TipoAlteracao { get; set; }
    [Required, MaxLength(2000)] public string Descricao { get; set; } = string.Empty;
    public bool IncluirDependentes { get; set; }
    public string? DependenteIdsJson { get; set; }
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed class SolicitacaoBeneficioUpdateRequest
{
    public TipoBeneficio TipoBeneficio { get; set; }
    public TipoAlteracaoBeneficio TipoAlteracao { get; set; }
    [Required, MaxLength(2000)] public string Descricao { get; set; } = string.Empty;
    public bool IncluirDependentes { get; set; }
    public string? DependenteIdsJson { get; set; }
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed record SolicitacaoBeneficioResponse(
    Guid Id, SolicitacaoStatus Status,
    Guid SolicitanteId, string? SolicitanteNome,
    TipoBeneficio TipoBeneficio, TipoAlteracaoBeneficio TipoAlteracao,
    string Descricao, bool IncluirDependentes, string? DependenteIdsJson,
    Guid? Aprovador1Id, string? Aprovador1Nome, StatusAprovacao Aprovador1Status, DateTimeOffset? Aprovador1DataUtc,
    Guid? Aprovador2Id, string? Aprovador2Nome, StatusAprovacao? Aprovador2Status, DateTimeOffset? Aprovador2DataUtc,
    bool Aprovador2Habilitado,
    string? ObservacaoAprovador, string? Observacoes,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado, string? IntegracaoMensagem, DateTimeOffset? IntegradaEmUtc
);

public sealed class SolicitacaoBeneficioApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed record SolicitacaoBeneficioGridRow(
    Guid Id, SolicitacaoStatus Status, string? SolicitanteNome,
    TipoBeneficio TipoBeneficio, TipoAlteracaoBeneficio TipoAlteracao,
    DateTimeOffset CreatedAtUtc
);
