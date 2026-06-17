using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace LiotecnicaHub.Web.Application.Authentication;

public interface IEntraTokenValidator
{
    Task<ClaimsPrincipal?> ValidateIdTokenAsync(string idToken, CancellationToken ct);
}

public sealed class EntraTokenValidator : IEntraTokenValidator
{
    private readonly IHubEntraConfigService _configService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ConcurrentDictionary<string, ConfigurationManager<OpenIdConnectConfiguration>> _configManagers
        = new(StringComparer.OrdinalIgnoreCase);

    public EntraTokenValidator(IHubEntraConfigService configService, IHttpClientFactory httpClientFactory)
    {
        _configService = configService;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<ClaimsPrincipal?> ValidateIdTokenAsync(string idToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(idToken))
            return null;

        var config = await _configService.GetDecryptedAsync(ct);
        if (config is null || !config.IsEnabled)
            return null;

        var tenantId = config.EntraTenantId?.Trim();
        var clientId = config.ClientId?.Trim();
        if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(clientId))
            return null;

        try
        {
            var authority = $"https://login.microsoftonline.com/{tenantId}/v2.0";
            var manager = _configManagers.GetOrAdd(authority, _ =>
            {
                var retriever = new HttpDocumentRetriever(_httpClientFactory.CreateClient())
                {
                    RequireHttps = true
                };
                return new ConfigurationManager<OpenIdConnectConfiguration>(
                    $"{authority}/.well-known/openid-configuration",
                    new OpenIdConnectConfigurationRetriever(),
                    retriever);
            });

            var oidcConfig = await manager.GetConfigurationAsync(ct);
            var tokenHandler = new JwtSecurityTokenHandler();
            if (!tokenHandler.CanReadToken(idToken))
                return null;

            var parameters = new TokenValidationParameters
            {
                ValidAudiences = new[] { clientId },
                ValidateAudience = true,
                ValidIssuers = new[]
                {
                    $"https://login.microsoftonline.com/{tenantId}/v2.0",
                    $"https://sts.windows.net/{tenantId}/"
                },
                ValidateIssuer = true,
                IssuerSigningKeys = oidcConfig.SigningKeys,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(2)
            };

            return tokenHandler.ValidateToken(idToken, parameters, out _);
        }
        catch (SecurityTokenException)
        {
            return null;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }
}
