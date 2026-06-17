using System.Security.Claims;
using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Application.Authentication;

public static class HubClaimTypes
{
    public const string Email = ClaimTypes.Email;
    public const string Name = ClaimTypes.Name;
    public const string UserId = "hub:user_id";
    public const string IsHubAdmin = "hub:is_admin";
}

public interface IHubAuthService
{
    Task SignInFromEntraPrincipalAsync(ClaimsPrincipal entraPrincipal, CancellationToken ct);
    Task SignInDevAsync(string email, CancellationToken ct);
}

public sealed class HubAuthService : IHubAuthService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly HubDbContext _db;
    private readonly IHubUserProvisioningService _provisioning;

    public HubAuthService(
        IHttpContextAccessor httpContextAccessor,
        HubDbContext db,
        IHubUserProvisioningService provisioning)
    {
        _httpContextAccessor = httpContextAccessor;
        _db = db;
        _provisioning = provisioning;
    }

    public async Task SignInFromEntraPrincipalAsync(ClaimsPrincipal entraPrincipal, CancellationToken ct)
    {
        var http = _httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("HttpContext indisponível.");

        var email = ResolveEmail(entraPrincipal);
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException("E-mail não encontrado no token Entra.");

        email = email.Trim().ToLowerInvariant();
        var displayName = entraPrincipal.FindFirst("name")?.Value
            ?? entraPrincipal.FindFirst(ClaimTypes.Name)?.Value
            ?? email;

        var isAdmin = await _db.Admins.AsNoTracking()
            .AnyAsync(a => a.Email == email, ct);

        var user = await _provisioning.EnsureUserAsync(email, displayName, ct);

        var claims = new List<Claim>
        {
            new(HubClaimTypes.Email, email),
            new(HubClaimTypes.Name, displayName),
            new(HubClaimTypes.UserId, user.Id.ToString()),
            new(HubClaimTypes.IsHubAdmin, isAdmin ? "true" : "false")
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await http.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
            });
    }

    public async Task SignInDevAsync(string email, CancellationToken ct)
    {
        var http = _httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("HttpContext indisponível.");

        email = email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new InvalidOperationException("Informe um e-mail válido.");

        var isAdmin = await _db.Admins.AsNoTracking()
            .AnyAsync(a => a.Email == email, ct);

        var user = await _provisioning.EnsureUserAsync(email, email, ct);

        var claims = new List<Claim>
        {
            new(HubClaimTypes.Email, email),
            new(HubClaimTypes.Name, email),
            new(HubClaimTypes.UserId, user.Id.ToString()),
            new(HubClaimTypes.IsHubAdmin, isAdmin ? "true" : "false"),
            new("hub:dev_login", "true")
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await http.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
            });
    }

    public static string? ResolveEmail(ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value
            ?? principal.FindFirst("preferred_username")?.Value
            ?? principal.FindFirst("upn")?.Value;
    }
}
