using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Mapeia quais perfis (Roles) podem abrir vagas para cada nível hierárquico.
/// Ex: "Coordenador" pode abrir vagas para Analista e Assistente, mas não para Gerente.
/// </summary>
public sealed class PermissaoNivelVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Nível hierárquico do cargo da vaga que pode ser aberta.</summary>
    public Guid NivelHierarquicoId { get; set; }
    public NivelHierarquico? NivelHierarquico { get; set; }

    /// <summary>Perfil (Role) que tem permissão para abrir vagas deste nível.</summary>
    public Guid RoleId { get; set; }
    public ApplicationRole? Role { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
