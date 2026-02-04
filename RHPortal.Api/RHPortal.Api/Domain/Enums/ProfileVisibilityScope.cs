namespace RHPortal.Api.Domain.Enums;

/// <summary>
/// Escopo de visão do perfil: estrutura completa ou restrito à área/recrutador.
/// </summary>
public enum ProfileVisibilityScope : short
{
    /// <summary>Ver toda a estrutura quando habilitado para a tela.</summary>
    FullStructure = 0,

    /// <summary>Restringir aos dados da área ou do recrutador do usuário.</summary>
    RestrictedByAreaOrRecruiter = 1
}
