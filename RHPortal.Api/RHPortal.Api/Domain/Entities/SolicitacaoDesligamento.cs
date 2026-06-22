using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de desligamento de funcionário, feita pelo gestor e aprovada por RH/Admin.
/// </summary>
public sealed class SolicitacaoDesligamento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante ──

    /// <summary>Gestor que criou a solicitação.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    // ── Dados do desligamento ──

    /// <summary>Funcionário a ser desligado.</summary>
    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>Empresa da solicitação (A.RH.015).</summary>
    public Guid? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>Estabelecimento/Local conforme A.RH.015. Mesmo padrão de UnitId em SolicitacaoVaga.</summary>
    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    /// <summary>Funcionário possui histórico de medidas disciplinares? null = não informado.</summary>
    public bool? HistoricoMedidasDisciplinares { get; set; }

    public DateOnly DataDesligamento { get; set; }

    public TipoDesligamento TipoDesligamento { get; set; }

    /// <summary>Justificativa/motivo do desligamento.</summary>
    public string MotivoDesligamento { get; set; } = default!;

    public TipoAvisoPrevio TipoAvisoPrevio { get; set; }

    /// <summary>Dias de aviso prévio (calculado conforme CLT: 30 + 3 por ano trabalhado, máx 90).</summary>
    public int DiasAvisoPrevio { get; set; } = 30;

    /// <summary>Indica se o funcionário possui estabilidade de emprego.</summary>
    public bool PossuiEstabilidade { get; set; }

    /// <summary>Indica se o funcionário é elegível para recontratação futura.</summary>
    public bool ElegivelRecontratacao { get; set; }

    /// <summary>Se true, após aprovação gera automaticamente uma SolicitacaoVaga para a posição.</summary>
    public bool SubstituirPosicao { get; set; }

    /// <summary>SolicitacaoVaga gerada automaticamente na aprovação (quando SubstituirPosicao = true).</summary>
    public Guid? SolicitacaoVagaGeradaId { get; set; }

    /// <summary>SolicitacaoVaga que originou este desligamento (fluxo inverso: vaga de substituição que dispara desligamento na 1ª aprovação).</summary>
    public Guid? SolicitacaoVagaOrigemId { get; set; }

    // ── Status e Aprovação ──

    public SolicitacaoStatus Status { get; set; } = SolicitacaoStatus.Rascunho;

    public string? ObservacaoAprovador { get; set; }
    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── Integração TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }

    /// <summary>Código de vínculo RM (<c>TIPO|COL|IDREQ</c>, ex.: <c>DESLIGAMENTO|1|8421</c>).</summary>
    [StringLength(120)]
    public string? RmRequisicaoCodigo { get; set; }

    /// <summary>Coligada da requisição RM (<c>CODCOLREQUISICAO</c>).</summary>
    public short? RmCodColRequisicao { get; set; }

    /// <summary>Identificador numérico da requisição no RM (<c>IDREQ</c>).</summary>
    public int? RmIdReq { get; set; }

    /// <summary>Espelho do <c>CODSTATUS</c> da requisição no RM.</summary>
    public short? RmCodStatus { get; set; }

    /// <summary>Último <c>STATUS_DESCRICAO</c> lido no RM.</summary>
    [StringLength(240)]
    public string? RmUltimaStatusDescricaoRm { get; set; }

    /// <summary>Último instante sincronizado com estado da requisição no RM.</summary>
    public DateTimeOffset? RmUltimaSincronizacaoUtc { get; set; }

    public Guid? EfetivadoManualmentePorId { get; set; }
    public DateTimeOffset? EfetivadoManualmenteEmUtc { get; set; }

    public int TentativasIntegracao { get; set; }
    public DateTimeOffset? UltimaTentativaUtc { get; set; }
}
