using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de abertura de vaga feita por um gestor, sujeita a aprovação do superior da área.
/// </summary>
public sealed class SolicitacaoVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Funcionário (gestor) que criou a solicitação.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    /// <summary>Funcionário (superior da área) responsável pela aprovação.</summary>
    public Guid? AprovadorId { get; set; }
    public Funcionario? Aprovador { get; set; }

    /// <summary>Cargo desejado.</summary>
    public Guid? JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    /// <summary>Área solicitante.</summary>
    public Guid? AreaId { get; set; }
    public Area? Area { get; set; }

    /// <summary>Unidade/filial.</summary>
    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    /// <summary>Empresa solicitante (A.RH.013).</summary>
    public Guid? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>Centro de custo da vaga (A.RH.013).</summary>
    public Guid? CentroCustoId { get; set; }
    public CentroCusto? CentroCusto { get; set; }

    /// <summary>Unidade de lotação da vaga (A.RH.013).</summary>
    public Guid? UnidadeLotacaoId { get; set; }
    public UnidadeLotacao? UnidadeLotacao { get; set; }

    /// <summary>Título descritivo (pode diferir do cargo).</summary>
    public string Titulo { get; set; } = default!;

    /// <summary>Justificativa da contratação.</summary>
    public string? Justificativa { get; set; }

    /// <summary>Quantidade de posições a preencher.</summary>
    public int QtdPosicoes { get; set; } = 1;

    public SolicitacaoVagaUrgencia Urgencia { get; set; } = SolicitacaoVagaUrgencia.Media;

    public SolicitacaoVagaStatus Status { get; set; } = SolicitacaoVagaStatus.Rascunho;

    /// <summary>Vaga criada automaticamente após aprovação.</summary>
    public Guid? VagaId { get; set; }

    /// <summary>Observação do aprovador (ao aprovar, reprovar ou solicitar ajustes).</summary>
    public string? ObservacaoAprovador { get; set; }

    // ── Sprint 1: campos novos ──

    /// <summary>Vaga nova ou substituição.</summary>
    public TipoSolicitacaoVaga TipoSolicitacao { get; set; } = TipoSolicitacaoVaga.VagaNova;

    /// <summary>Indica se a vaga é confidencial.</summary>
    public bool IsConfidencial { get; set; }

    /// <summary>Funcionário sendo substituído (quando TipoSolicitacao = Substituicao).</summary>
    public Guid? SubstituidoFuncionarioId { get; set; }
    public Funcionario? SubstituidoFuncionario { get; set; }

    /// <summary>Nome do substituído (desnormalizado para consultas rápidas).</summary>
    public string? SubstituidoNome { get; set; }

    // ── A.RH.013: Campos do formulário de requisição de pessoal ──

    /// <summary>Tipo de contrato: CLT, Estágio, Aprendiz, Temporário.</summary>
    public TipoContratoVaga TipoContrato { get; set; } = TipoContratoVaga.CLT;

    /// <summary>Prazo em dias (para Estágio e Temporário).</summary>
    public int? PrazoDias { get; set; }

    /// <summary>Motivo estruturado da requisição.</summary>
    public MotivoRequisicaoVaga? MotivoRequisicao { get; set; }

    /// <summary>CNH obrigatória para a vaga.</summary>
    public bool CnhObrigatoria { get; set; }

    /// <summary>Disponibilidade para viagens.</summary>
    public bool DisponibilidadeViagens { get; set; }

    /// <summary>Escala de trabalho (ex: Comercial, Turno A/B, 12x36).</summary>
    public string? EscalaTrabalho { get; set; }

    // ── Decisão RH pós-aprovação (VagaNova) ──

    /// <summary>Decisão do RH: substituição provisória ou aumento definitivo de headcount.</summary>
    public TipoDecisaoHeadcount? DecisaoRH { get; set; }

    /// <summary>Funcionário do RH que tomou a decisão.</summary>
    public Guid? DecisaoRHRevisadoPorId { get; set; }
    public Funcionario? DecisaoRHRevisadoPor { get; set; }

    /// <summary>Data/hora em que o RH tomou a decisão.</summary>
    public DateTimeOffset? DecisaoRHEmUtc { get; set; }

    /// <summary>Prazo em meses para a substituição provisória (quando DecisaoRH = SubstituicaoProvisoria).</summary>
    public int? DecisaoRHPrazoMeses { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── Dados de desligamento (quando MotivoRequisicao = PedidoDemissao ou DesligamentoSemJustaCausa) ──

    /// <summary>Funcionário que será desligado — igual a SubstituidoFuncionarioId; campo semântico para o fluxo de desligamento.</summary>
    public DateOnly? DataDesligamento { get; set; }

    public TipoAvisoPrevio? TipoAvisoPrevioDesligamento { get; set; }

    public int? DiasAvisoPrevioDesligamento { get; set; }

    public bool? PossuiEstabilidadeDesligamento { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(2000)]
    public string? MotivoDesligamentoTexto { get; set; }

    /// <summary>Solicitação de desligamento gerada automaticamente na primeira aprovação desta vaga.</summary>
    public Guid? DesligamentoVinculadoId { get; set; }

    // ── Amarração com candidato contratado ──

    /// <summary>Candidato contratado para esta vaga (amarrado quando a pré-admissão é efetivada).</summary>
    public Guid? CandidatoContratadoId { get; set; }
    public Candidato? CandidatoContratado { get; set; }

    // ── Integração TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }

    public Guid? EfetivadoManualmentePorId { get; set; }
    public DateTimeOffset? EfetivadoManualmenteEmUtc { get; set; }

    public int TentativasIntegracao { get; set; }
    public DateTimeOffset? UltimaTentativaUtc { get; set; }
}
