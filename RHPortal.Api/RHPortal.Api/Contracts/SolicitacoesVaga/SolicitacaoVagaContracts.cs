using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesVaga;

// ── List query ──

public sealed record SolicitacaoVagaListQuery(
    string? Q,
    SolicitacaoVagaStatus? Status,
    bool? ApenasMeus,
    int? Page,
    int? PageSize
);

// ── Create / Update ──

public sealed class SolicitacaoVagaCreateRequest
{
    [Required, MaxLength(160)]
    public string Titulo { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Justificativa { get; set; }

    public int QtdPosicoes { get; set; } = 1;

    public SolicitacaoVagaUrgencia Urgencia { get; set; } = SolicitacaoVagaUrgencia.Media;

    public Guid? JobPositionId { get; set; }
    public Guid? AreaId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? AprovadorId { get; set; }

    // Sprint 1
    public TipoSolicitacaoVaga TipoSolicitacao { get; set; } = TipoSolicitacaoVaga.VagaNova;
    public bool IsConfidencial { get; set; }
    public Guid? SubstituidoFuncionarioId { get; set; }
    // Sprint 2
    public bool Aprovador2Habilitado { get; set; }

    // A.RH.013
    public TipoContratoVaga TipoContrato { get; set; } = TipoContratoVaga.CLT;
    public int? PrazoDias { get; set; }
    public MotivoRequisicaoVaga? MotivoRequisicao { get; set; }
    public bool CnhObrigatoria { get; set; }
    public bool DisponibilidadeViagens { get; set; }
    public string? EscalaTrabalho { get; set; }
    public Guid? EmpresaId { get; set; }
    public Guid? CentroCustoId { get; set; }
    public Guid? UnidadeLotacaoId { get; set; }
}

public sealed class SolicitacaoVagaUpdateRequest
{
    [Required, MaxLength(160)]
    public string Titulo { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Justificativa { get; set; }

    public int QtdPosicoes { get; set; } = 1;

    public SolicitacaoVagaUrgencia Urgencia { get; set; } = SolicitacaoVagaUrgencia.Media;

    public Guid? JobPositionId { get; set; }
    public Guid? AreaId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? AprovadorId { get; set; }

    // Sprint 1
    public TipoSolicitacaoVaga TipoSolicitacao { get; set; } = TipoSolicitacaoVaga.VagaNova;
    public bool IsConfidencial { get; set; }
    public Guid? SubstituidoFuncionarioId { get; set; }
    // Sprint 2
    public bool Aprovador2Habilitado { get; set; }

    // A.RH.013
    public TipoContratoVaga TipoContrato { get; set; } = TipoContratoVaga.CLT;
    public int? PrazoDias { get; set; }
    public MotivoRequisicaoVaga? MotivoRequisicao { get; set; }
    public bool CnhObrigatoria { get; set; }
    public bool DisponibilidadeViagens { get; set; }
    public string? EscalaTrabalho { get; set; }
    public Guid? EmpresaId { get; set; }
    public Guid? CentroCustoId { get; set; }
    public Guid? UnidadeLotacaoId { get; set; }
}

// ── Approval actions ──

public sealed class SolicitacaoVagaApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

// ── Response ──

public sealed record SolicitacaoVagaResponse(
    Guid Id,
    string Titulo,
    string? Justificativa,
    int QtdPosicoes,
    SolicitacaoVagaUrgencia Urgencia,
    SolicitacaoVagaStatus Status,
    Guid SolicitanteId,
    string? SolicitanteNome,
    Guid? AprovadorId,
    string? AprovadorNome,
    Guid? JobPositionId,
    string? JobPositionName,
    Guid? AreaId,
    string? AreaName,
    Guid? UnitId,
    string? UnitName,
    Guid? VagaId,
    string? ObservacaoAprovador,
    // Sprint 1
    TipoSolicitacaoVaga TipoSolicitacao,
    bool IsConfidencial,
    Guid? SubstituidoFuncionarioId,
    string? SubstituidoNome,
    // A.RH.013
    TipoContratoVaga TipoContrato,
    int? PrazoDias,
    MotivoRequisicaoVaga? MotivoRequisicao,
    bool CnhObrigatoria,
    bool DisponibilidadeViagens,
    string? EscalaTrabalho,
    Guid? EmpresaId,
    string? EmpresaNome,
    Guid? CentroCustoId,
    string? CentroCustoNome,
    Guid? UnidadeLotacaoId,
    string? UnidadeLotacaoNome,
    // Sprint 2
    Guid? Aprovador1Id,
    string? Aprovador1Nome,
    StatusAprovacao Aprovador1Status,
    DateTimeOffset? Aprovador1DataUtc,
    Guid? Aprovador2Id,
    string? Aprovador2Nome,
    StatusAprovacao? Aprovador2Status,
    DateTimeOffset? Aprovador2DataUtc,
    bool Aprovador2Habilitado,
    Guid? Aprovador3Id,
    string? Aprovador3Nome,
    StatusAprovacao? Aprovador3Status,
    DateTimeOffset? Aprovador3DataUtc,
    bool Aprovador3Habilitado,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ApprovedAtUtc
);

public sealed record SolicitacaoVagaGridRow(
    Guid Id,
    string Titulo,
    SolicitacaoVagaUrgencia Urgencia,
    SolicitacaoVagaStatus Status,
    Guid? SolicitanteId,
    string? SolicitanteNome,
    Guid? AprovadorId,
    string? AprovadorNome,
    string? AreaName,
    int QtdPosicoes,
    // Sprint 1
    TipoSolicitacaoVaga TipoSolicitacao,
    bool IsConfidencial,
    string? SubstituidoNome,
    DateTimeOffset CreatedAtUtc
);
