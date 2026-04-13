using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Template configurável de etapa de workflow RH por tenant.
/// N etapas por (TenantId, TipoWorkflow), ordenadas por Ordem.
/// Mesmo padrão de EtapaConfigAprovacao, mas para workflows operacionais do RH.
/// </summary>
public sealed class EtapaConfigWorkflowRH : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public TipoWorkflowRH TipoWorkflow { get; set; }

    /// <summary>Sequência da etapa (1, 2, 3…).</summary>
    public int Ordem { get; set; }

    /// <summary>Código legível por máquina (ex: "revisao-requisicao").</summary>
    public string Codigo { get; set; } = "";

    /// <summary>Label exibido na UI.</summary>
    public string Label { get; set; } = "";

    /// <summary>Instruções padrão para o RH.</summary>
    public string? Descricao { get; set; }

    /// <summary>SLA padrão em dias úteis.</summary>
    public int? SlaPrazoDias { get; set; }

    /// <summary>Se true, a etapa não pode ser pulada pelo RH.</summary>
    public bool Obrigatoria { get; set; } = true;

    /// <summary>
    /// Perfil padrão que será copiado para a etapa em execução.
    /// Qualquer usuário com esse role pode assumir a etapa.
    /// </summary>
    public Guid? RoleFilaId { get; set; }
    public ApplicationRole? RoleFila { get; set; }

    public bool Ativo { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
