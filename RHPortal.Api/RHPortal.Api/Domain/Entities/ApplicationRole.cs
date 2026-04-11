using Microsoft.AspNetCore.Identity;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class ApplicationRole : IdentityRole<Guid>, ITenantEntity
{
    public string TenantId { get; set; } = default!;
    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>Visão na estrutura: completa ou restrita à área/recrutador.</summary>
    public ProfileVisibilityScope VisibilityScope { get; set; } = ProfileVisibilityScope.FullStructure;

    /// <summary>Escopo de dados para vagas: todas, por área ou por recrutador.</summary>
    public VagasDataScope VagasDataScope { get; set; } = VagasDataScope.All;

    /// <summary>Modo de acesso: completo ou somente leitura.</summary>
    public ProfileAccessMode AccessMode { get; set; } = ProfileAccessMode.Full;

    /// <summary>Tipo/categoria do perfil: RH, Colaborador ou Gestor.</summary>
    public RoleTipo Tipo { get; set; } = RoleTipo.Colaborador;
}
