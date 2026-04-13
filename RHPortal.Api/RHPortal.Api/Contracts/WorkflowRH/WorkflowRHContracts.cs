using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.WorkflowRH;

// ── List / Grid ────────────────────────────────────────────

public sealed record WorkflowRHGridRow(
    Guid   Id,
    short  TipoWorkflow,       // TipoWorkflowRH enum value
    string TipoWorkflowLabel,  // "Triagem Vaga" | "Revisão Pós-Efetivação"
    short  Status,              // WorkflowRHStatus enum value
    string StatusLabel,         // "Não Iniciado", "Em Andamento", "Concluído", "Cancelado"
    Guid?  VagaId,
    string? VagaTitulo,
    Guid?  PreAdmissaoId,
    string? CandidatoNome,
    Guid?  ResponsavelId,
    string? ResponsavelNome,
    int    TotalEtapas,
    int    EtapasConcluidas,
    string? EtapaAtualLabel,    // Label da etapa em andamento
    int?   SlaPrazoDias,
    bool   SlaExcedido,
    DateTimeOffset CreatedAtUtc
);

// ── Detail ─────────────────────────────────────────────────

public sealed record WorkflowRHDetailResponse(
    Guid   Id,
    short  TipoWorkflow,
    string TipoWorkflowLabel,
    short  Status,
    string StatusLabel,
    Guid?  VagaId,
    string? VagaTitulo,
    Guid?  PreAdmissaoId,
    string? CandidatoNome,
    Guid?  ResponsavelId,
    string? ResponsavelNome,
    DateTimeOffset? DataInicio,
    DateTimeOffset? DataConclusao,
    int?   SlaPrazoDias,
    bool   SlaExcedido,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    EtapaWorkflowRHResponse[] Etapas,
    // Dados da solicitação original (pré-preenchidos pelo gestor)
    DadosSolicitacaoSnapshot? DadosSolicitacao
);

public sealed record EtapaWorkflowRHResponse(
    Guid   Id,
    int    Ordem,
    string Codigo,
    string Label,
    string? Descricao,
    short  Status,             // EtapaWorkflowRHStatus enum value
    string StatusLabel,        // "Não Iniciada", "Em Andamento", "Concluída", "Pulada", "Bloqueada"
    bool   Obrigatoria,
    Guid?  ResponsavelId,
    string? ResponsavelNome,
    Guid?  RoleFilaId,
    string? RoleFilaNome,
    int?   SlaPrazoDias,
    bool   SlaExcedido,
    DateTimeOffset? DataInicio,
    DateTimeOffset? DataConclusao,
    string? DadosJson,
    string? Observacoes,
    DateTimeOffset CreatedAtUtc
);

/// <summary>
/// Snapshot dos dados preenchidos pelo gestor na solicitação original.
/// Usado para exibir no step "Revisão da Requisição" com badges de origem.
/// </summary>
public sealed record DadosSolicitacaoSnapshot(
    Guid   SolicitacaoId,
    string? Titulo,
    string? Justificativa,
    int    QtdPosicoes,
    string? UrgenciaLabel,
    string? TipoSolicitacaoLabel,
    bool   IsConfidencial,
    string? SubstituidoNome,
    string? JobPositionName,
    string? AreaName,
    string? UnitName,
    string? TipoContratoLabel,
    int?   PrazoDias,
    string? MotivoRequisicaoLabel,
    bool?  CnhObrigatoria,
    bool?  DisponibilidadeViagens,
    string? EscalaTrabalho,
    string? EmpresaNome,
    string? CentroCustoNome,
    string? UnidadeLotacaoNome,
    string  SolicitanteNome,
    DateTimeOffset SolicitacaoCriadaEm
);

// ── Requests ───────────────────────────────────────────────

public sealed class WorkflowRHListQuery
{
    public short? TipoWorkflow { get; set; }
    public short? Status { get; set; }
    public string? Q { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class ConcluirEtapaRequest
{
    public string? DadosJson { get; set; }
    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class PularEtapaRequest
{
    [Required]
    [MaxLength(2000)]
    public string Observacoes { get; set; } = "";
}

public sealed class SalvarDadosEtapaRequest
{
    public string? DadosJson { get; set; }
}

// ── Histórico ──────────────────────────────────────────────

public sealed record HistoricoAlteracaoResponse(
    Guid   Id,
    Guid?  EtapaWorkflowId,
    string? EtapaLabel,
    string Campo,
    string? ValorAnterior,
    string? ValorNovo,
    short  OrigemPreenchimento,  // OrigemPreenchimento enum value
    string OrigemLabel,          // "Gestor", "RH", "Sistema"
    Guid   AlteradoPorId,
    string AlteradoPorNome,
    DateTimeOffset DataAlteracaoUtc,
    string? Observacao
);

// ── Config Admin ───────────────────────────────────────────

public sealed record EtapaConfigWorkflowRHDto(
    Guid   Id,
    int    Ordem,
    string Codigo,
    string Label,
    string? Descricao,
    int?   SlaPrazoDias,
    bool   Obrigatoria,
    Guid?  RoleFilaId,
    string? RoleFilaNome,
    bool   Ativo
);

public sealed class EtapaConfigWorkflowRHSaveRequest
{
    public int Ordem { get; set; }
    [Required]
    [MaxLength(50)]
    public string Codigo { get; set; } = "";
    [Required]
    [MaxLength(160)]
    public string Label { get; set; } = "";
    [MaxLength(500)]
    public string? Descricao { get; set; }
    public int? SlaPrazoDias { get; set; }
    public bool Obrigatoria { get; set; } = true;
    public Guid? RoleFilaId { get; set; }
}
