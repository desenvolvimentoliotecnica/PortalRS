using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesPromocao;

public sealed record SolicitacaoPromocaoListQuery(
    string? Q,
    SolicitacaoStatus? Status,
    bool? ApenasMeus,
    int? Page,
    int? PageSize
);

public sealed class SolicitacaoPromocaoCreateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    [Required]
    public DateOnly DataEfetiva { get; set; }

    public Guid? CargoAtualId { get; set; }

    [Required]
    public Guid NovoCargoId { get; set; }

    public Guid? AreaAtualId { get; set; }

    public Guid? NovaAreaId { get; set; }

    [Required, MaxLength(2000)]
    public string Justificativa { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class SolicitacaoPromocaoUpdateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    [Required]
    public DateOnly DataEfetiva { get; set; }

    public Guid? CargoAtualId { get; set; }

    [Required]
    public Guid NovoCargoId { get; set; }

    public Guid? AreaAtualId { get; set; }

    public Guid? NovaAreaId { get; set; }

    [Required, MaxLength(2000)]
    public string Justificativa { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed record SolicitacaoPromocaoResponse(
    Guid Id,
    SolicitacaoStatus Status,
    Guid SolicitanteId,
    string? SolicitanteNome,
    Guid FuncionarioId,
    string? FuncionarioNome,
    DateOnly DataEfetiva,
    Guid? CargoAtualId,
    string? CargoAtualNome,
    Guid NovoCargoId,
    string? NovoCargoNome,
    Guid? AreaAtualId,
    string? AreaAtualNome,
    Guid? NovaAreaId,
    string? NovaAreaNome,
    string Justificativa,
    // Approval chain
    Guid? Aprovador1Id,
    string? Aprovador1Nome,
    StatusAprovacao Aprovador1Status,
    DateTimeOffset? Aprovador1DataUtc,
    Guid? Aprovador2Id,
    string? Aprovador2Nome,
    StatusAprovacao? Aprovador2Status,
    DateTimeOffset? Aprovador2DataUtc,
    bool Aprovador2Habilitado,
    string? ObservacaoAprovador,
    string? Observacoes,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ApprovedAtUtc
);

public sealed record SolicitacaoPromocaoGridRow(
    Guid Id,
    SolicitacaoStatus Status,
    string? SolicitanteNome,
    string? FuncionarioNome,
    string? NovoCargoNome,
    DateOnly DataEfetiva,
    DateTimeOffset CreatedAtUtc
);
