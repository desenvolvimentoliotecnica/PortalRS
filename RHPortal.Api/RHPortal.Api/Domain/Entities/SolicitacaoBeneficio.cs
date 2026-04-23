using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de alteração de benefício feita pelo colaborador, aprovada por RH.
/// </summary>
public sealed class SolicitacaoBeneficio : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante ──

    /// <summary>Colaborador que solicita a alteração.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    // ── Dados do benefício ──

    public TipoBeneficio TipoBeneficio { get; set; }

    public TipoAlteracaoBeneficio TipoAlteracao { get; set; }

    /// <summary>Descrição detalhada da alteração desejada.</summary>
    public string Descricao { get; set; } = default!;

    /// <summary>Se true, a alteração inclui dependentes.</summary>
    public bool IncluirDependentes { get; set; }

    /// <summary>IDs dos dependentes incluídos (armazenado como JSON array de Guids).</summary>
    public string? DependenteIdsJson { get; set; }

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

    public Guid? EfetivadoManualmentePorId { get; set; }
    public DateTimeOffset? EfetivadoManualmenteEmUtc { get; set; }

    public int TentativasIntegracao { get; set; }
    public DateTimeOffset? UltimaTentativaUtc { get; set; }
}
