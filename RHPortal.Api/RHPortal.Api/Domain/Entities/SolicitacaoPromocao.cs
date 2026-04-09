using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de promoção de funcionário, feita pelo gestor e aprovada por RH/Admin.
/// </summary>
public sealed class SolicitacaoPromocao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante ──

    /// <summary>Gestor que criou a solicitação.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    // ── Dados da promoção ──

    /// <summary>Funcionário a ser promovido.</summary>
    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>Data efetiva da promoção.</summary>
    public DateOnly DataEfetiva { get; set; }

    /// <summary>Cargo atual (auto-preenchido ao selecionar funcionário).</summary>
    public Guid? CargoAtualId { get; set; }
    public JobPosition? CargoAtual { get; set; }

    /// <summary>Novo cargo proposto.</summary>
    public Guid NovoCargoId { get; set; }
    public JobPosition? NovoCargo { get; set; }

    /// <summary>Área atual (auto-preenchida ao selecionar funcionário).</summary>
    public Guid? AreaAtualId { get; set; }
    public Area? AreaAtual { get; set; }

    /// <summary>Nova área (se houver mudança de departamento).</summary>
    public Guid? NovaAreaId { get; set; }
    public Area? NovaArea { get; set; }

    /// <summary>Justificativa da promoção.</summary>
    public string Justificativa { get; set; } = default!;

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
