using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de inclusão/alteração/exclusão de dependente, feita pelo colaborador e aprovada por RH.
/// Na aprovação, executa o CRUD real na tabela Dependente.
/// </summary>
public sealed class SolicitacaoDependente : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante ──

    /// <summary>Colaborador que solicita a mudança.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    // ── Dados do dependente ──

    public TipoSolicitacaoDependente TipoSolicitacao { get; set; }

    /// <summary>Dependente existente (para alteração/exclusão).</summary>
    public Guid? DependenteId { get; set; }
    public Dependente? DependenteExistente { get; set; }

    public string NomeCompleto { get; set; } = default!;
    public Parentesco Parentesco { get; set; }
    public string? Cpf { get; set; }
    public DateOnly DataNascimento { get; set; }
    public bool IsPcd { get; set; }

    /// <summary>Se o dependente é declarado para fins de Imposto de Renda.</summary>
    public bool DependenteIR { get; set; }

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
}
