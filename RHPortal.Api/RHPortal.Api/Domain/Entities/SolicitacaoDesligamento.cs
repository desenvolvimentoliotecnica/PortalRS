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

    public DateOnly DataDesligamento { get; set; }

    public TipoDesligamento TipoDesligamento { get; set; }

    /// <summary>Justificativa/motivo do desligamento.</summary>
    public string MotivoDesligamento { get; set; } = default!;

    public TipoAvisoPrevio TipoAvisoPrevio { get; set; }

    /// <summary>Dias de aviso prévio (calculado conforme CLT: 30 + 3 por ano trabalhado, máx 90).</summary>
    public int DiasAvisoPrevio { get; set; } = 30;

    /// <summary>Indica se o funcionário é elegível para recontratação futura.</summary>
    public bool ElegivelRecontratacao { get; set; }

    /// <summary>Se true, após aprovação gera automaticamente uma SolicitacaoVaga para a posição.</summary>
    public bool SubstituirPosicao { get; set; }

    /// <summary>SolicitacaoVaga gerada automaticamente na aprovação (quando SubstituirPosicao = true).</summary>
    public Guid? SolicitacaoVagaGeradaId { get; set; }

    // ── Status e Aprovação ──

    public SolicitacaoStatus Status { get; set; } = SolicitacaoStatus.Rascunho;

    public Guid? Aprovador1Id { get; set; }
    public Funcionario? Aprovador1 { get; set; }
    public StatusAprovacao Aprovador1Status { get; set; } = StatusAprovacao.Pendente;
    public DateTimeOffset? Aprovador1DataUtc { get; set; }

    public Guid? Aprovador2Id { get; set; }
    public Funcionario? Aprovador2 { get; set; }
    public StatusAprovacao? Aprovador2Status { get; set; }
    public DateTimeOffset? Aprovador2DataUtc { get; set; }
    public bool Aprovador2Habilitado { get; set; }

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
}
