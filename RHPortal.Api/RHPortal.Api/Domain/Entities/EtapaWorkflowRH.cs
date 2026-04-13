using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Etapa individual em execução dentro de um WorkflowRH.
/// Criada como snapshot do template (EtapaConfigWorkflowRH) no momento da criação do workflow.
/// Steps são sequenciais: o próximo fica Bloqueada até o anterior ser Concluída ou Pulada.
/// </summary>
public sealed class EtapaWorkflowRH : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid WorkflowId { get; set; }
    public WorkflowRH? Workflow { get; set; }

    /// <summary>Sequência da etapa (1, 2, 3…).</summary>
    public int Ordem { get; set; }

    /// <summary>Código legível por máquina (ex: "revisao-requisicao", "complemento-dados").</summary>
    public string Codigo { get; set; } = "";

    /// <summary>Label exibido na UI (ex: "Revisão da Requisição").</summary>
    public string Label { get; set; } = "";

    /// <summary>Instruções para o RH sobre o que fazer nesta etapa.</summary>
    public string? Descricao { get; set; }

    public EtapaWorkflowRHStatus Status { get; set; } = EtapaWorkflowRHStatus.Bloqueada;

    /// <summary>Se true, a etapa não pode ser pulada.</summary>
    public bool Obrigatoria { get; set; } = true;

    /// <summary>Funcionário RH responsável por esta etapa.</summary>
    public Guid? ResponsavelId { get; set; }
    public Funcionario? Responsavel { get; set; }

    /// <summary>
    /// Perfil (ApplicationRole) que serve de fila. Qualquer usuário com esse role pode assumir.
    /// Mesmo padrão de SolicitacaoAprovacaoEtapa.RoleFilaId.
    /// </summary>
    public Guid? RoleFilaId { get; set; }

    /// <summary>SLA desta etapa em dias úteis.</summary>
    public int? SlaPrazoDias { get; set; }

    public DateTimeOffset? DataInicio { get; set; }
    public DateTimeOffset? DataConclusao { get; set; }

    /// <summary>
    /// JSON blob com dados específicos do step.
    /// Cada tipo de step (código) tem schema próprio.
    /// Evita N colunas por tipo de step.
    /// </summary>
    public string? DadosJson { get; set; }

    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
