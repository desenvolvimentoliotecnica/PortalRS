namespace RHPortal.Api.Domain.Enums;

/// <summary>
/// Modo de acesso do perfil: completo ou somente leitura.
/// </summary>
public enum ProfileAccessMode : short
{
    /// <summary>Acesso completo (leitura e escrita).</summary>
    Full = 0,

    /// <summary>Somente consulta (bloquear POST/PUT/DELETE).</summary>
    ReadOnly = 1
}
