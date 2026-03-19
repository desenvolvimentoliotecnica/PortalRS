using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de aprovação de faixa salarial para um cargo.
/// Workflow separado do fluxo de aprovação de vaga.
/// </summary>
public sealed class AprovacaoFaixaSalarial : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FaixaSalarialId { get; set; }
    public FaixaSalarial? FaixaSalarial { get; set; }

    public Guid? SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    /// <summary>Valor proposto (novo salário).</summary>
    public decimal ValorProposto { get; set; }

    /// <summary>Justificativa da alteração.</summary>
    [MaxLength(1000)]
    public string? Justificativa { get; set; }

    public StatusAprovacaoFaixa Status { get; set; } = StatusAprovacaoFaixa.Pendente;

    public Guid? AprovadorId { get; set; }
    public Funcionario? Aprovador { get; set; }

    [MaxLength(500)]
    public string? ObservacaoAprovador { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? AprovadoEmUtc { get; set; }
}

public enum StatusAprovacaoFaixa : short
{
    Pendente = 0,
    Aprovada = 1,
    Reprovada = 2
}
