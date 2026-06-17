using System.Security.Cryptography;
using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Infrastructure.Options;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace LiotecnicaHub.Web.Application.Authentication;

public interface IHubLaunchService
{
    string BuildLaunchUrl(HubApplication app, string userEmail);
}

public sealed class HubLaunchService : IHubLaunchService
{
    private readonly HubOptions _options;

    public HubLaunchService(IOptions<HubOptions> options) => _options = options.Value;

    public string BuildLaunchUrl(HubApplication app, string userEmail)
    {
        if (TryBuildPortalRhSsoUrl(app.LaunchUrl, userEmail, out var ssoUrl))
            return ssoUrl;

        return app.LaunchUrl;
    }

    internal bool TryBuildPortalRhSsoUrl(string launchUrl, string userEmail, out string ssoUrl)
    {
        ssoUrl = string.Empty;
        if (!TryParsePortalRhLaunch(launchUrl, out var apiOrigin, out var tenantId, out var returnUrl))
            return false;

        var signingKey = ResolveSsoSigningKey();
        if (string.IsNullOrWhiteSpace(signingKey))
            return false;

        var payload = new HubSsoTokenPayload(
            Email: userEmail.Trim().ToLowerInvariant(),
            TenantId: tenantId,
            ReturnUrl: returnUrl,
            Nonce: Convert.ToHexString(RandomNumberGenerator.GetBytes(8)),
            IssuedAtUnix: DateTimeOffset.UtcNow.ToUnixTimeSeconds());

        var token = HubSsoTokenCodec.Encode(payload, signingKey);
        ssoUrl =
            $"{apiOrigin}/api/auth/hub-sso" +
            $"?token={Uri.EscapeDataString(token)}" +
            $"&returnUrl={Uri.EscapeDataString(returnUrl)}";
        return true;
    }

    private string? ResolveSsoSigningKey()
    {
        if (!string.IsNullOrWhiteSpace(_options.SsoSigningKey))
            return _options.SsoSigningKey;

        return string.IsNullOrWhiteSpace(_options.StateSigningKey) ? null : _options.StateSigningKey;
    }

    internal static bool TryParsePortalRhLaunch(
        string launchUrl,
        out string apiOrigin,
        out string tenantId,
        out string returnUrl)
    {
        apiOrigin = string.Empty;
        tenantId = string.Empty;
        returnUrl = "/dashboard";

        if (!Uri.TryCreate(launchUrl, UriKind.Absolute, out var uri))
            return false;

        if (!uri.AbsolutePath.Contains("/app/login", StringComparison.OrdinalIgnoreCase))
            return false;

        var query = QueryHelpers.ParseQuery(uri.Query);
        if (!query.TryGetValue("tenant", out var tenantValues))
            return false;

        tenantId = tenantValues.ToString().Trim();
        if (string.IsNullOrWhiteSpace(tenantId))
            return false;

        if (query.TryGetValue("returnUrl", out var returnValues))
        {
            var rawReturn = returnValues.ToString().Trim();
            if (!string.IsNullOrWhiteSpace(rawReturn) && rawReturn.StartsWith('/'))
                returnUrl = rawReturn;
        }

        apiOrigin = uri.GetLeftPart(UriPartial.Authority);
        return true;
    }
}
