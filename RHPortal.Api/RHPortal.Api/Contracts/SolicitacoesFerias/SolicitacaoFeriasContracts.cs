using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesFerias;

public sealed record SolicitacaoFeriasListQuery(string? Q, SolicitacaoStatus? Status, bool? ApenasMeus, int? Page, int? PageSize);

public sealed class SolicitacaoFeriasCreateRequest
{
    public string? PeriodoAquisitivo { get; set; }
    [Required] public DateOnly DataInicio { get; set; }
    [Required] public DateOnly DataFim { get; set; }
    public int QtdDias { get; set; }
    public bool AbonoPecuniario { get; set; }
    public int DiasAbono { get; set; }
    public bool Adiantamento13 { get; set; }
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed class SolicitacaoFeriasUpdateRequest
{
    public string? PeriodoAquisitivo { get; set; }
    [Required] public DateOnly DataInicio { get; set; }
    [Required] public DateOnly DataFim { get; set; }
    public int QtdDias { get; set; }
    public bool AbonoPecuniario { get; set; }
    public int DiasAbono { get; set; }
    public bool Adiantamento13 { get; set; }
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed record SolicitacaoFeriasResponse(
    Guid Id, SolicitacaoStatus Status,
    Guid SolicitanteId, string? SolicitanteNome,
    string? PeriodoAquisitivo, DateOnly DataInicio, DateOnly DataFim, int QtdDias,
    bool AbonoPecuniario, int DiasAbono, bool Adiantamento13,
    string? ObservacaoAprovador, string? Observacoes,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado, string? IntegracaoMensagem, DateTimeOffset? IntegradaEmUtc,
    IReadOnlyList<RhPortal.Api.Contracts.Common.EtapaAprovacaoResponse> Etapas
);

public sealed class SolicitacaoFeriasApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed record SolicitacaoFeriasGridRow(
    Guid Id, SolicitacaoStatus Status, string? SolicitanteNome,
    DateOnly DataInicio, DateOnly DataFim, int QtdDias,
    bool AbonoPecuniario, DateTimeOffset CreatedAtUtc,
    string? EtapaPendenteLabel, string? EtapaPendenteCom,
    bool EtapaPendenteIsQueue, Guid? EtapaPendenteAprovadorId
);
