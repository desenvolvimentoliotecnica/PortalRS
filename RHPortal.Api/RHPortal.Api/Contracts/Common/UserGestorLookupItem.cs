namespace RhPortal.Api.Contracts.Common;

/// <summary>
/// Usuário com perfil Gestor, para seleção no cadastro de gestores.
/// </summary>
public sealed record UserGestorLookupItem(
    Guid Id,
    string Name,
    string Email
);
