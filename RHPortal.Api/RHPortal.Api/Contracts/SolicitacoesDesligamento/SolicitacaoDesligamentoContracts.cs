using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesDesligamento;

public sealed record SolicitacaoDesligamentoListQuery(
    string? Q,
    SolicitacaoStatus? Status,
    bool? ApenasMeus,
    int? Page,
    int? PageSize
);

public sealed class SolicitacaoDesligamentoCreateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    [Required]
    public DateOnly DataDesligamento { get; set; }

    public TipoDesligamento TipoDesligamento { get; set; }

    [Required, MaxLength(2000)]
    public string MotivoDesligamento { get; set; } = string.Empty;

    public TipoAvisoPrevio TipoAvisoPrevio { get; set; }

    public int DiasAvisoPrevio { get; set; } = 30;

    public bool ElegivelRecontratacao { get; set; }

    public bool SubstituirPosicao { get; set; }

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class SolicitacaoDesligamentoUpdateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    [Required]
    public DateOnly DataDesligamento { get; set; }

    public TipoDesligamento TipoDesligamento { get; set; }

    [Required, MaxLength(2000)]
    public string MotivoDesligamento { get; set; } = string.Empty;

    public TipoAvisoPrevio TipoAvisoPrevio { get; set; }

    public int DiasAvisoPrevio { get; set; } = 30;

    public bool ElegivelRecontratacao { get; set; }

    public bool SubstituirPosicao { get; set; }

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class SolicitacaoApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed record SolicitacaoDesligamentoResponse(
    Guid Id,
    SolicitacaoStatus Status,
    Guid SolicitanteId,
    string? SolicitanteNome,
    Guid FuncionarioId,
    string? FuncionarioNome,
    DateOnly DataDesligamento,
    TipoDesligamento TipoDesligamento,
    string MotivoDesligamento,
    TipoAvisoPrevio TipoAvisoPrevio,
    int DiasAvisoPrevio,
    bool ElegivelRecontratacao,
    bool SubstituirPosicao,
    Guid? SolicitacaoVagaGeradaId,
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
    DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    DateTimeOffset? IntegradaEmUtc
);

public sealed record SolicitacaoDesligamentoGridRow(
    Guid Id,
    SolicitacaoStatus Status,
    string? SolicitanteNome,
    string? FuncionarioNome,
    TipoDesligamento TipoDesligamento,
    DateOnly DataDesligamento,
    DateTimeOffset CreatedAtUtc
);
