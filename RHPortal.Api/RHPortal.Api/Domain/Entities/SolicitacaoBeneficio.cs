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
}
