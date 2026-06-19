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
    Task SignInWithPasswordAsync(string email, string password, CancellationToken ct);
}

public sealed class HubAuthService : IHubAuthService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly HubDbContext _db;
    private readonly IHubUserProvisioningService _provisioning;
    private readonly IHubPasswordService _passwords;

    public HubAuthService(
        IHttpContextAccessor httpContextAccessor,
        HubDbContext db,
        IHubUserProvisioningService provisioning,
        IHubPasswordService passwords)
    {
        _httpContextAccessor = httpContextAccessor;
        _db = db;
        _provisioning = provisioning;
        _passwords = passwords;
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

        await SignInUserAsync(http, user, email, displayName, isAdmin);
    }

    public async Task SignInWithPasswordAsync(string email, string password, CancellationToken ct)
    {
        var http = _httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("HttpContext indisponível.");

        email = email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new InvalidOperationException("Informe um e-mail válido.");

        if (string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("Informe a senha.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !user.IsActive)
            throw new InvalidOperationException("E-mail ou senha inválidos.");

        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            throw new InvalidOperationException(
                "Este usuário não possui senha local. Use o login Microsoft ou peça ao administrador para definir uma senha.");

        if (!_passwords.VerifyPassword(user, password))
            throw new InvalidOperationException("E-mail ou senha inválidos.");

        var isAdmin = await _db.Admins.AsNoTracking()
            .AnyAsync(a => a.Email == email, ct);

        await SignInUserAsync(http, user, email, user.Name, isAdmin);
    }

    public static string? ResolveEmail(ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value
            ?? principal.FindFirst("preferred_username")?.Value
            ?? principal.FindFirst("upn")?.Value;
    }

    private static async Task SignInUserAsync(
        HttpContext http,
        Domain.Entities.HubUser user,
        string email,
        string displayName,
        bool isAdmin)
    {
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
}
