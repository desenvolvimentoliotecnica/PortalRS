namespace RHPortal.Api.Domain.Enums;

/// <summary>Tipo/categoria do perfil de acesso.</summary>
public enum RoleTipo : short
{
    /// <summary>Perfil de Recursos Humanos.</summary>
    RH = 0,

    /// <summary>Perfil de Colaborador.</summary>
    Colaborador = 1,

    /// <summary>Perfil de Gestor.</summary>
    Gestor = 2,

    /// <summary>Perfil de Compliance.</summary>
    Compliance = 3
}
