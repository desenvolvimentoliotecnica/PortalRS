using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Registro de auditoria para alterações feitas em dados de um workflow RH.
/// Rastreia quem alterou o quê, quando, e se o dado foi originalmente preenchido pelo gestor ou pelo RH.
/// </summary>
public sealed class HistoricoAlteracaoWorkflowRH : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid WorkflowId { get; set; }
    public WorkflowRH? Workflow { get; set; }

    /// <summary>Etapa onde a alteração ocorreu (null se for alteração no workflow geral).</summary>
    public Guid? EtapaWorkflowId { get; set; }
    public EtapaWorkflowRH? EtapaWorkflow { get; set; }

    /// <summary>Nome do campo alterado (ex: "Titulo", "FaixaSalarialMin", "TipoContrato").</summary>
    public string Campo { get; set; } = "";

    /// <summary>Valor antes da alteração (serializado como string). Null se campo era vazio.</summary>
    public string? ValorAnterior { get; set; }

    /// <summary>Valor após a alteração (serializado como string).</summary>
    public string? ValorNovo { get; set; }

    /// <summary>Quem preencheu originalmente este campo.</summary>
    public OrigemPreenchimento OrigemPreenchimento { get; set; }

    /// <summary>Funcionário que fez a alteração.</summary>
    public Guid AlteradoPorId { get; set; }
    public Funcionario? AlteradoPor { get; set; }

    /// <summary>Snapshot do nome do funcionário (para exibição rápida sem join).</summary>
    public string AlteradoPorNome { get; set; } = "";

    public DateTimeOffset DataAlteracaoUtc { get; set; }

    /// <summary>Justificativa da alteração (obrigatória quando RH altera campo do gestor).</summary>
    public string? Observacao { get; set; }
}
