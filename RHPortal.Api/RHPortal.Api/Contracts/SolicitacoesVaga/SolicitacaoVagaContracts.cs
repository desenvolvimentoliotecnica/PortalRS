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

/// <summary>Contagens por chip de status na grid, respeitando o mesmo escopo de visibilidade da listagem.</summary>
public sealed record SolicitacaoVagaContagensResponse(
    int Ativas,
    int Aprovadas,
    int Reprovadas,
    int Canceladas,
    int Todas,
    int AguardandoDistribuicao,
    IReadOnlyList<string> StatusAtivosKeys,
    IReadOnlyList<string> StatusAprovadosKeys
);

// ── Create / Update ──

public sealed class SolicitacaoVagaCreateRequest
{
    [Required, MaxLength(160)]
    public string Titulo { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? CodFuncaoRm { get; set; }

    [MaxLength(160)]
    public string? FuncaoNomeRm { get; set; }

    /// <remarks>
    /// RN03 / CMP: se <see cref="TipoSolicitacao"/> for <see cref="TipoSolicitacaoVaga.AumentoQuadro"/>,
    /// justificativa detalhada deve estar preenchida antes do envio (validação Fase 2 / submissão); rascunhos podem ficar sem texto.
    /// </remarks>
    [MaxLength(2000)]
    public string? Justificativa { get; set; }

    public int QtdPosicoes { get; set; } = 1;

    public SolicitacaoVagaUrgencia Urgencia { get; set; } = SolicitacaoVagaUrgencia.Media;

    public Guid? JobPositionId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? AprovadorId { get; set; }

    // Vaga pré-vinculada (quando solicitação é criada a partir do painel de vagas)
    public Guid? VagaId { get; set; }

    /// <remarks>Inclui <see cref="TipoSolicitacaoVaga.AumentoQuadro"/> para o fluxo integrado RN02 ao RM.</remarks>
    // Sprint 1
    public TipoSolicitacaoVaga TipoSolicitacao { get; set; } = TipoSolicitacaoVaga.VagaNova;
    public bool IsConfidencial { get; set; }
    public Guid? SubstituidoFuncionarioId { get; set; }

    // A.RH.013
    public TipoContratoVaga TipoContrato { get; set; } = TipoContratoVaga.CLT;
    public int? PrazoDias { get; set; }

    /// <summary>Motivo legado (enum). Mantido para compatibilidade — prefira <see cref="MotivoRequisicaoId"/>.</summary>
    public MotivoRequisicaoVaga? MotivoRequisicao { get; set; }

    /// <summary>FK da tabela parametrizável de motivos (MotivosRequisicaoVagaConfig).</summary>
    public Guid? MotivoRequisicaoId { get; set; }

    public bool CnhObrigatoria { get; set; }
    public bool DisponibilidadeViagens { get; set; }

    /// <summary>Turno cadastrado (opcional). Quando preenchido, a API deriva <see cref="EscalaTrabalho"/> como rótulo do turno.</summary>
    public Guid? TurnoId { get; set; }

    /// <summary>Texto livre ou JSON legado; usado apenas quando <see cref="TurnoId"/> é null.</summary>
    public string? EscalaTrabalho { get; set; }
    public Guid? EmpresaId { get; set; }
    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
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

    /// <summary>Proposta salarial — piso da faixa (espelho RM / negociação).</summary>
    public decimal? FaixaSalarialMin { get; set; }

    /// <summary>Proposta salarial — teto da faixa.</summary>
    public decimal? FaixaSalarialMax { get; set; }

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
    public Guid? UnitId { get; set; }
    public Guid? AprovadorId { get; set; }

    // Vaga pré-vinculada (quando solicitação é criada a partir do painel de vagas)
    public Guid? VagaId { get; set; }

    [MaxLength(20)]
    public string? CodFuncaoRm { get; set; }

    [MaxLength(160)]
    public string? FuncaoNomeRm { get; set; }

    /// <remarks>Inclui <see cref="TipoSolicitacaoVaga.AumentoQuadro"/> para o fluxo integrado RN02 ao RM.</remarks>
    // Sprint 1
    public TipoSolicitacaoVaga TipoSolicitacao { get; set; } = TipoSolicitacaoVaga.VagaNova;
    public bool IsConfidencial { get; set; }
    public Guid? SubstituidoFuncionarioId { get; set; }

    // A.RH.013
    public TipoContratoVaga TipoContrato { get; set; } = TipoContratoVaga.CLT;
    public int? PrazoDias { get; set; }

    /// <summary>Motivo legado (enum). Mantido para compatibilidade — prefira <see cref="MotivoRequisicaoId"/>.</summary>
    public MotivoRequisicaoVaga? MotivoRequisicao { get; set; }

    /// <summary>FK da tabela parametrizável de motivos (MotivosRequisicaoVagaConfig).</summary>
    public Guid? MotivoRequisicaoId { get; set; }

    public bool CnhObrigatoria { get; set; }
    public bool DisponibilidadeViagens { get; set; }

    /// <summary>Turno cadastrado (opcional). Quando preenchido, a API deriva <see cref="EscalaTrabalho"/> como rótulo do turno.</summary>
    public Guid? TurnoId { get; set; }

    /// <summary>Texto livre ou JSON legado; usado apenas quando <see cref="TurnoId"/> é null.</summary>
    public string? EscalaTrabalho { get; set; }
    public Guid? EmpresaId { get; set; }
    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
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

    /// <summary>Proposta salarial — piso da faixa (espelho RM / negociação).</summary>
    public decimal? FaixaSalarialMin { get; set; }

    /// <summary>Proposta salarial — teto da faixa.</summary>
    public decimal? FaixaSalarialMax { get; set; }

}

// ── Approval actions ──

public sealed class SolicitacaoVagaApprovalRequest
{
    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed record AssignAnalistaRhRequest(Guid? AnalistaRhResponsavelUserId);

public sealed class BulkAssignAnalistaRhRequest
{
    [Required]
    public IReadOnlyList<Guid> SolicitacaoIds { get; set; } = Array.Empty<Guid>();

    public Guid? AnalistaRhResponsavelUserId { get; set; }
}

// ── Triagem (fluxo AumentoQuadro — CMP-03 / FLX-02…FLX-04) ──

/// <summary>Devolução da triagem ao gestor para ajustes.</summary>
public sealed class SolicitacaoVagaTriagemDevolverRequest
{
    /// <summary>Texto obrigatório explicando pendências (histórico + campo de observação).</summary>
    [Required, MaxLength(4000)]
    public string Observacao { get; set; } = string.Empty;
}

/// <summary>Reprovação interna na triagem (sem criar etapas de aprovação).</summary>
public sealed class SolicitacaoVagaTriagemReprovarRequest
{
    [Required, MaxLength(4000)]
    public string Motivo { get; set; } = string.Empty;
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

public sealed record SolicitacaoTimelineEventoInfo(
    int Ordem,
    string Label,
    string? Nome,
    int? Status,
    DateTimeOffset? DataUtc,
    string? Observacao
);

public sealed record SolicitacaoVagaRmParecerInfo(
    int IdParecer,
    DateTimeOffset? DataParecer,
    short? CodStatus,
    string? Status,
    string? Solicitante,
    string? ChapaSolicitante,
    string? Parecer
);

// ── Response ──

public sealed record SolicitacaoVagaResponse(
    Guid Id,
    string Titulo,
    string? CodFuncaoRm,
    string? FuncaoNomeRm,
    string? Justificativa,
    int QtdPosicoes,
    SolicitacaoVagaUrgencia Urgencia,
    SolicitacaoStatus Status,
    Guid SolicitanteId,
    string? SolicitanteNome,
    Guid? AprovadorId,
    string? AprovadorNome,
    Guid? AnalistaRhResponsavelUserId,
    string? AnalistaRhResponsavelNome,
    Guid? JobPositionId,
    string? JobPositionName,
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
    /// <summary>Motivo legado (enum) — mantido para compatibilidade com clientes antigos.</summary>
    MotivoRequisicaoVaga? MotivoRequisicao,
    /// <summary>FK do motivo parametrizável. Preferir este campo.</summary>
    Guid? MotivoRequisicaoId,
    string? MotivoRequisicaoCodigo,
    string? MotivoRequisicaoNome,
    EfeitoHeadcount? MotivoRequisicaoEfeito,
    bool CnhObrigatoria,
    bool DisponibilidadeViagens,
    string? EscalaTrabalho,
    Guid? TurnoId,
    string? TurnoCode,
    string? TurnoDescription,
    string? TurnoStartTime,
    string? TurnoEndTime,
    string? TurnoNotes,
    string? TurnoUnidadeLotacaoNome,
    Guid? EmpresaId,
    string? EmpresaNome,
    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
    Guid? CentroCustoId,
    string? CentroCustoNome,
    Guid? UnidadeLotacaoId,
    string? UnidadeLotacaoNome,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ApprovedAtUtc,
    IReadOnlyList<EtapaFluxoInfo> EtapasFluxo,
    IReadOnlyList<SolicitacaoTimelineEventoInfo> TimelineEventos,
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
    string? CandidatoContratadoNome,
    /// <summary>CODSTATUS lido do RM na última sincronização (SYN).</summary>
    short? RmCodStatus,
    string? RmUltimaStatusDescricaoRm,
    string? RmStatusSyncUltimaMensagem,
    DateTimeOffset? RmUltimaSincronizacaoUtc,
    string? RmRequisicaoCodigo,
    DateTimeOffset? RmCriacaoSolicitadaEmUtc,
    short? RmCodColRequisicao,
    int? RmIdReq,
    int TentativasIntegracao,
    DateTimeOffset? UltimaTentativaUtc,
    decimal? FaixaSalarialMin,
    decimal? FaixaSalarialMax,
    IReadOnlyList<SolicitacaoVagaRmParecerInfo> RmPareceres
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
    Guid? AnalistaRhResponsavelUserId,
    string? AnalistaRhResponsavelNome,
    /// <summary>Nome do centro de custo — absorveu Area em 31.2.</summary>
    string? CentroCustoNome,
    int QtdPosicoes,
    // Sprint 1
    TipoSolicitacaoVaga TipoSolicitacao,
    bool IsConfidencial,
    string? SubstituidoNome,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? RmCriacaoSolicitadaEmUtc,
    short? RmCodColRequisicao,
    int? RmIdReq,
    string? RmRequisicaoCodigo,
    int TentativasIntegracao,
    DateTimeOffset? UltimaTentativaUtc,
    short? RmCodStatus,
    string? RmUltimaStatusDescricaoRm,
    string? RmStatusSyncUltimaMensagem,
    DateTimeOffset? RmUltimaSincronizacaoUtc,
    string? EtapaPendenteLabel,
    string? EtapaPendenteCom,
    bool EtapaPendenteIsQueue,
    Guid? EtapaPendenteAprovadorId,
    Guid? EtapaPendenteAssumedByUserId,
    bool EtapaPendenteCanAssume,
    Guid? VagaId
);

// ── Indicações internas (SEL‑03) ──

public sealed record SolicitacaoVagaIndicacaoDto(
    Guid Id,
    Guid CandidatoId,
    string? CandidatoNome,
    string? Observacao,
    Guid? IndicadoPorUserId,
    DateTimeOffset CreatedAtUtc);

public sealed class SolicitacaoVagaIndicacaoCreateRequest
{
    [Required]
    public Guid CandidatoId { get; set; }

    [MaxLength(2000)]
    public string? Observacao { get; set; }
}

public sealed class SolicitacaoVagaSelecaObservacaoRequest
{
    [Required, MaxLength(2000)]
    public string Observacao { get; set; } = string.Empty;
}
