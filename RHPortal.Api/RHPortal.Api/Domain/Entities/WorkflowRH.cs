using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Instância de workflow operacional do RH, atrelada a uma Vaga (pré-efetivação)
/// ou PreAdmissão (pós-efetivação). Cada workflow contém N etapas sequenciais.
/// </summary>
public sealed class WorkflowRH : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public TipoWorkflowRH TipoWorkflow { get; set; }

    /// <summary>FK para Vaga (usado quando TipoWorkflow = TriagemVaga).</summary>
    public Guid? VagaId { get; set; }
    public Vaga? Vaga { get; set; }

    /// <summary>FK para PreAdmissão (usado quando TipoWorkflow = RevisaoPosEfetivacao).</summary>
    public Guid? PreAdmissaoId { get; set; }
    public PreAdmissao? PreAdmissao { get; set; }

    public WorkflowRHStatus Status { get; set; } = WorkflowRHStatus.NaoIniciado;

    /// <summary>Funcionário RH responsável/líder deste workflow.</summary>
    public Guid? ResponsavelId { get; set; }
    public Funcionario? Responsavel { get; set; }

    public DateTimeOffset? DataInicio { get; set; }
    public DateTimeOffset? DataConclusao { get; set; }

    /// <summary>SLA geral do workflow em dias úteis.</summary>
    public int? SlaPrazoDias { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    // Navigation
    public List<EtapaWorkflowRH> Etapas { get; set; } = new();
    public List<HistoricoAlteracaoWorkflowRH> Historico { get; set; } = new();
}
