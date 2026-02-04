using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Security;

public static class ApiKeyConstants
{
    public const string ApiKeyScheme = "ApiKey";
    public const string ApiKeyHeaderName = "X-Api-Key";
}

public sealed class ApiKeyAuthenticationOptions : AuthenticationSchemeOptions
{
    public string HeaderName { get; set; } = ApiKeyConstants.ApiKeyHeaderName;
}

public sealed class ApiKeyAuthenticationHandler : AuthenticationHandler<ApiKeyAuthenticationOptions>
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<ApiKeyAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        AppDbContext db,
        ITenantContext tenantContext)
        : base(options, logger, encoder)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var headerName = Options.HeaderName;
        if (!Request.Headers.TryGetValue(headerName, out var keyValues) || string.IsNullOrWhiteSpace(keyValues))
            return AuthenticateResult.NoResult();

        var rawKey = keyValues.ToString().Trim();
        if (string.IsNullOrEmpty(rawKey))
            return AuthenticateResult.NoResult();

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId) || tenantId == "owner")
            return AuthenticateResult.Fail("API Key requires a valid tenant context.");

        var keyHash = ComputeSha256Hash(rawKey);
        var apiKey = await _db.ApiKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.KeyHash == keyHash && x.IsActive, Context.RequestAborted);

        if (apiKey is null)
            return AuthenticateResult.Fail("Invalid or inactive API Key.");

        // Update LastUsedAt (fire-and-forget to avoid blocking response)
        _ = Task.Run(async () =>
        {
            try
            {
                await using var scope = Context.RequestServices.CreateAsyncScope();
                var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var key = await scopedDb.ApiKeys.FindAsync(apiKey.Id);
                if (key is not null)
                {
                    key.LastUsedAtUtc = DateTimeOffset.UtcNow;
                    await scopedDb.SaveChangesAsync();
                }
            }
            catch
            {
                // Ignore; last-used is non-critical
            }
        }, Context.RequestAborted);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, apiKey.Id.ToString()),
            new Claim(ClaimTypes.Name, apiKey.Name),
            new Claim(ClaimTypes.Role, "ApiKey"),
            new Claim("tenant", tenantId),
            new Claim("auth_type", "ApiKey")
        };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return AuthenticateResult.Success(ticket);
    }

    private static string ComputeSha256Hash(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}
