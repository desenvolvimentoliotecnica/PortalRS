namespace RhPortal.Api.Contracts.Common;

/// <summary>
/// Usuário com perfil Recrutador, para atribuição de vaga ao analista responsável.
/// (Atribuição manual de vaga — feature de 2026-04-26.)
/// </summary>
public sealed record UserRecrutadorLookupItem(
    Guid Id,
    string Name,
    string Email
);
