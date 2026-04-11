using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Configuração de uma etapa da cadeia de aprovação para um tipo de fluxo.
/// N etapas por (TenantId, TipoFluxo), ordenadas por Ordem.
/// </summary>
public sealed class EtapaConfigAprovacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public TipoFluxoAprovacao TipoFluxo { get; set; }

    /// <summary>Sequência da etapa (1, 2, 3…). Define a ordem de execução.</summary>
    public int Ordem { get; set; }

    /// <summary>Label exibido na UI. Ex: "Responsável", "Gerência", "Compliance", "RH".</summary>
    public string Label { get; set; } = "";

    public TipoAprovador TipoAprovador { get; set; }

    /// <summary>Funcionário fixo. Usado quando TipoAprovador = FuncionarioFixo.</summary>
    public Guid? FuncionarioFixoId { get; set; }
    public Funcionario? FuncionarioFixo { get; set; }

    /// <summary>
    /// Perfil (ApplicationRole) que serve de fila.
    /// Usado quando TipoAprovador = FilaDePerfil.
    /// Qualquer usuário do perfil pode assumir e aprovar.
    /// </summary>
    public Guid? RoleFilaId { get; set; }
    public ApplicationRole? RoleFila { get; set; }

    public bool Ativo { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
