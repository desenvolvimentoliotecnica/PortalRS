using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesVaga;

// ── List query ──

public sealed record SolicitacaoVagaListQuery(
    string? Q,
    SolicitacaoStatus? Status,
    SolicitacaoStatus[]? Statuses,
    bool? ApenasMeus,
    int? Page,
    int? PageSize,
    Guid? VagaId = null
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

    // Vaga pré-vinculada (quando solicitação é criada a partir do painel de vagas)
    public Guid? VagaId { get; set; }

    // Sprint 1
    public TipoSolicitacaoVaga TipoSolicitacao { get; set; } = TipoSolicitacaoVaga.VagaNova;
    public bool IsConfidencial { get; set; }
    public Guid? SubstituidoFuncionarioId { get; set; }

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

    // Dados do desligamento (quando MotivoRequisicao = PedidoDemissao ou DesligamentoSemJustaCausa)
    public DateOnly? DataDesligamento { get; set; }
    public TipoAvisoPrevio? TipoAvisoPrevioDesligamento { get; set; }
    public int? DiasAvisoPrevioDesligamento { get; set; }
    public bool? PossuiEstabilidadeDesligamento { get; set; }

    [MaxLength(2000)]
    public string? MotivoDesligamentoTexto { get; set; }

    // Decisão de headcount — preenchida pelo gestor na criação.
    // Obrigatória ao submeter (SubmitAsync valida).
    public TipoDecisaoHeadcount? DecisaoRH { get; set; }
    public int? DecisaoRHPrazoMeses { get; set; }
    public DateTimeOffset? DecisaoRHPrazoDataAlvo { get; set; }
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

    // Vaga pré-vinculada (quando solicitação é criada a partir do painel de vagas)
    public Guid? VagaId { get; set; }

    // Sprint 1
    public TipoSolicitacaoVaga TipoSolicitacao { get; set; } = TipoSolicitacaoVaga.VagaNova;
    public bool IsConfidencial { get; set; }
    public Guid? SubstituidoFuncionarioId { get; set; }

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

    // Dados do desligamento (quando MotivoRequisicao = PedidoDemissao ou DesligamentoSemJustaCausa)
    public DateOnly? DataDesligamento { get; set; }
    public TipoAvisoPrevio? TipoAvisoPrevioDesligamento { get; set; }
    public int? DiasAvisoPrevioDesligamento { get; set; }
    public bool? PossuiEstabilidadeDesligamento { get; set; }

    [MaxLength(2000)]
    public string? MotivoDesligamentoTexto { get; set; }

    // Decisão de headcount — pode ser editada no rascunho
    public TipoDecisaoHeadcount? DecisaoRH { get; set; }
    public int? DecisaoRHPrazoMeses { get; set; }
    public DateTimeOffset? DecisaoRHPrazoDataAlvo { get; set; }
}

// ── Approval actions ──

public sealed class SolicitacaoVagaApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

// ── Vincular candidato contratado ──

public sealed record VincularCandidatoRequest(Guid CandidatoId);

// ── Workflow etapa snapshot ──

public sealed record EtapaFluxoInfo(
    int Ordem,
    string Label,
    string? AprovadorNome,
    string? RoleNome,
    StatusAprovacao Status,
    DateTimeOffset? DataUtc,
    string? Observacao
);

// ── Response ──

public sealed record SolicitacaoVagaResponse(
    Guid Id,
    string Titulo,
    string? Justificativa,
    int QtdPosicoes,
    SolicitacaoVagaUrgencia Urgencia,
    SolicitacaoStatus Status,
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
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ApprovedAtUtc,
    IReadOnlyList<EtapaFluxoInfo> EtapasFluxo,
    // Decisão RH pós-aprovação (VagaNova)
    TipoDecisaoHeadcount? DecisaoRH,
    string? DecisaoRHRevisadoPorNome,
    DateTimeOffset? DecisaoRHEmUtc,
    int? DecisaoRHPrazoMeses,
    // Dados do desligamento (quando MotivoRequisicao ∈ {PedidoDemissao, DesligamentoSemJustaCausa})
    DateOnly? DataDesligamento,
    TipoAvisoPrevio? TipoAvisoPrevioDesligamento,
    int? DiasAvisoPrevioDesligamento,
    bool? PossuiEstabilidadeDesligamento,
    string? MotivoDesligamentoTexto,
    Guid? DesligamentoVinculadoId,
    // Amarração com candidato contratado (preenchido quando a pré-admissão vinculada à vaga é efetivada)
    Guid? CandidatoContratadoId,
    string? CandidatoContratadoNome
);

public sealed record SolicitacaoVagaGridRow(
    Guid Id,
    string Titulo,
    SolicitacaoVagaUrgencia Urgencia,
    SolicitacaoStatus Status,
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
    DateTimeOffset CreatedAtUtc,
    string? EtapaPendenteLabel,
    string? EtapaPendenteCom,
    bool EtapaPendenteIsQueue,
    Guid? EtapaPendenteAprovadorId,
    Guid? EtapaPendenteAssumedByUserId,
    bool EtapaPendenteCanAssume
);
