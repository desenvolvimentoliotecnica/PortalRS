using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesDependente;

public sealed record SolicitacaoDependenteListQuery(string? Q, SolicitacaoStatus? Status, bool? ApenasMeus, int? Page, int? PageSize);

public sealed class SolicitacaoDependenteCreateRequest
{
    public TipoSolicitacaoDependente TipoSolicitacao { get; set; }
    public Guid? DependenteId { get; set; }
    [Required, MaxLength(200)] public string NomeCompleto { get; set; } = string.Empty;
    public Parentesco Parentesco { get; set; }
    [MaxLength(14)] public string? Cpf { get; set; }
    [Required] public DateOnly DataNascimento { get; set; }
    public bool IsPcd { get; set; }
    public bool DependenteIR { get; set; }
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed class SolicitacaoDependenteUpdateRequest
{
    public TipoSolicitacaoDependente TipoSolicitacao { get; set; }
    public Guid? DependenteId { get; set; }
    [Required, MaxLength(200)] public string NomeCompleto { get; set; } = string.Empty;
    public Parentesco Parentesco { get; set; }
    [MaxLength(14)] public string? Cpf { get; set; }
    [Required] public DateOnly DataNascimento { get; set; }
    public bool IsPcd { get; set; }
    public bool DependenteIR { get; set; }
    [MaxLength(2000)] public string? Observacoes { get; set; }
}

public sealed record SolicitacaoDependenteResponse(
    Guid Id, SolicitacaoStatus Status,
    Guid SolicitanteId, string? SolicitanteNome,
    TipoSolicitacaoDependente TipoSolicitacao, Guid? DependenteId,
    string NomeCompleto, Parentesco Parentesco, string? Cpf,
    DateOnly DataNascimento, bool IsPcd, bool DependenteIR,
    Guid? Aprovador1Id, string? Aprovador1Nome, StatusAprovacao Aprovador1Status, DateTimeOffset? Aprovador1DataUtc,
    Guid? Aprovador2Id, string? Aprovador2Nome, StatusAprovacao? Aprovador2Status, DateTimeOffset? Aprovador2DataUtc,
    bool Aprovador2Habilitado,
    string? ObservacaoAprovador, string? Observacoes,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, DateTimeOffset? ApprovedAtUtc
);

public sealed class SolicitacaoDependenteApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed record SolicitacaoDependenteGridRow(
    Guid Id, SolicitacaoStatus Status, string? SolicitanteNome,
    TipoSolicitacaoDependente TipoSolicitacao, string NomeCompleto,
    Parentesco Parentesco, DateTimeOffset CreatedAtUtc
);
