namespace RhPortal.Api.Infrastructure.IdentityProvider;

public interface IIdentityProviderService
{
    /// <summary>
    /// Desabilita a conta do usuário no Azure AD / Entra.
    /// Lança IdentityProviderNotConfiguredException se as credenciais não estão configuradas.
    /// </summary>
    Task<IdentityProviderResult> DisableUserAsync(
        string email, Guid funcionarioId, Guid? workflowId, Guid? etapaId,
        CancellationToken ct);

    /// <summary>Revoga todas as sessões ativas do usuário no Azure AD / Entra.</summary>
    Task<IdentityProviderResult> RevokeSessionsAsync(
        string email, Guid funcionarioId, Guid? workflowId, Guid? etapaId,
        CancellationToken ct);

    /// <summary>Habilita a conta (usado em onboarding ou reversão de desligamento).</summary>
    Task<IdentityProviderResult> EnableUserAsync(
        string email, Guid funcionarioId, Guid? workflowId, Guid? etapaId,
        CancellationToken ct);
}

public sealed record IdentityProviderResult(bool Sucesso, string? MensagemErro);

public sealed class IdentityProviderNotConfiguredException : Exception
{
    public IdentityProviderNotConfiguredException()
        : base("Credenciais Azure AD não configuradas para este tenant. Configure AzureAdTenantId, AzureAdClientId e AzureAdClientSecret em Configurações.")
    { }
}
