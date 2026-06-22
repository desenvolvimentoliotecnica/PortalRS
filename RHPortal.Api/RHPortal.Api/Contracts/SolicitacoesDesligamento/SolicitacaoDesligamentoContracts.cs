using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Contracts.EntrevistasSaida;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesDesligamento;

public sealed record SolicitacaoDesligamentoListQuery(
    string? Q,
    SolicitacaoStatus? Status,
    SolicitacaoStatus[]? Statuses,
    bool? ApenasMeus,
    Guid? AreaId,
    int? Page,
    int? PageSize
);

public sealed class SolicitacaoDesligamentoCreateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    public Guid? EmpresaId { get; set; }
    public Guid? UnitId { get; set; }
    public bool? HistoricoMedidasDisciplinares { get; set; }

    [Required]
    public DateOnly DataDesligamento { get; set; }

    public TipoDesligamento TipoDesligamento { get; set; }

    [Required, MaxLength(2000)]
    public string MotivoDesligamento { get; set; } = string.Empty;

    public TipoAvisoPrevio TipoAvisoPrevio { get; set; }

    public int DiasAvisoPrevio { get; set; } = 30;

    public bool PossuiEstabilidade { get; set; }

    public bool ElegivelRecontratacao { get; set; }

    public bool SubstituirPosicao { get; set; }

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class SolicitacaoDesligamentoUpdateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    public Guid? EmpresaId { get; set; }
    public Guid? UnitId { get; set; }
    public bool? HistoricoMedidasDisciplinares { get; set; }

    [Required]
    public DateOnly DataDesligamento { get; set; }

    public TipoDesligamento TipoDesligamento { get; set; }

    [Required, MaxLength(2000)]
    public string MotivoDesligamento { get; set; } = string.Empty;

    public TipoAvisoPrevio TipoAvisoPrevio { get; set; }

    public int DiasAvisoPrevio { get; set; } = 30;

    public bool PossuiEstabilidade { get; set; }

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
    Guid? EmpresaId,
    string? EmpresaNome,
    Guid? UnitId,
    string? UnitNome,
    bool? HistoricoMedidasDisciplinares,
    DateOnly DataDesligamento,
    TipoDesligamento TipoDesligamento,
    string MotivoDesligamento,
    TipoAvisoPrevio TipoAvisoPrevio,
    int DiasAvisoPrevio,
    bool PossuiEstabilidade,
    bool ElegivelRecontratacao,
    bool SubstituirPosicao,
    Guid? SolicitacaoVagaGeradaId,
    Guid? SolicitacaoVagaOrigemId,
    string? ObservacaoAprovador,
    string? Observacoes,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    DateTimeOffset? IntegradaEmUtc,
    IReadOnlyList<RhPortal.Api.Contracts.Common.EtapaAprovacaoResponse> Etapas
);

public sealed record SolicitacaoDesligamentoGridRow(
    Guid Id,
    SolicitacaoStatus Status,
    string? SolicitanteNome,
    string? FuncionarioNome,
    int? RmIdReq,
    TipoDesligamento TipoDesligamento,
    DateOnly DataDesligamento,
    DateTimeOffset CreatedAtUtc,
    string? EtapaPendenteLabel,
    string? EtapaPendenteCom,
    bool EtapaPendenteIsQueue,
    Guid? EtapaPendenteAprovadorId,
    Guid? EtapaPendenteAssumedByUserId,
    bool EtapaPendenteCanAssume,
    bool EtapaPendenteCanApprove,
    EntrevistaSaidaStatusCode? EntrevistaSaidaStatus,
    DateTimeOffset? EntrevistaSaidaEnviadaEmUtc,
    DateTimeOffset? EntrevistaSaidaRespondidaEmUtc
);

public sealed record SolicitacaoDesligamentoPendenteIntegracaoRow(
    Guid Id,
    string? FuncionarioNome,
    DateOnly DataDesligamento,
    SolicitacaoStatus Status
);
