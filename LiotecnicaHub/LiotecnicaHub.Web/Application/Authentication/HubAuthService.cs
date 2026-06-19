using System.Security.Claims;
using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Infrastructure.Data;
using LiotecnicaHub.Web.Infrastructure.Options;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

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
    private readonly IHubLdapConfigService _ldapConfig;
    private readonly IHubLdapAuthService _ldapAuth;
    private readonly HubOptions _hubOptions;

    public HubAuthService(
        IHttpContextAccessor httpContextAccessor,
        HubDbContext db,
        IHubUserProvisioningService provisioning,
        IHubPasswordService passwords,
        IHubLdapConfigService ldapConfig,
        IHubLdapAuthService ldapAuth,
        IOptions<HubOptions> hubOptions)
    {
        _httpContextAccessor = httpContextAccessor;
        _db = db;
        _provisioning = provisioning;
        _passwords = passwords;
        _ldapConfig = ldapConfig;
        _ldapAuth = ldapAuth;
        _hubOptions = hubOptions.Value;
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
        if (!user.IsActive)
            throw new InvalidOperationException("Usuário inativo. Contate o administrador.");

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
        var isAdmin = await _db.Admins.AsNoTracking()
            .AnyAsync(a => a.Email == email, ct);

        if (user is not null && !string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            if (!user.IsActive)
                throw new InvalidOperationException("E-mail ou senha inválidos.");

            if (!_passwords.VerifyPassword(user, password))
                throw new InvalidOperationException("E-mail ou senha inválidos.");

            await SignInUserAsync(http, user, email, user.Name, isAdmin);
            return;
        }

        var ldapConfig = await _ldapConfig.GetDecryptedAsync(ct);
        if (ldapConfig is { IsEnabled: true }
            && !string.IsNullOrWhiteSpace(ldapConfig.Server)
            && !string.IsNullOrWhiteSpace(ldapConfig.BaseDn))
        {
            var ldapResult = await _ldapAuth.ValidateCredentialsAsync(email, password, ldapConfig, ct);
            if (!ldapResult.Success)
                throw new InvalidOperationException(ldapResult.ErrorMessage ?? "E-mail ou senha inválidos.");

            user = await _provisioning.EnsureUserAsync(email, ldapResult.DisplayName, ct);
            if (!user.IsActive)
                throw new InvalidOperationException("Usuário inativo. Contate o administrador.");

            await SignInUserAsync(http, user, email, user.Name, isAdmin);
            return;
        }

        if (!IsLocalPasswordLoginEnabled())
            throw new InvalidOperationException(
                "Login por senha local não está habilitado. Use o login Microsoft ou LDAP.");

        if (user is null || !user.IsActive)
            throw new InvalidOperationException("E-mail ou senha inválidos.");

        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            throw new InvalidOperationException(
                "Este usuário não possui senha local. Use o login Microsoft/LDAP ou peça ao administrador para definir uma senha.");

        if (!_passwords.VerifyPassword(user, password))
            throw new InvalidOperationException("E-mail ou senha inválidos.");

        await SignInUserAsync(http, user, email, user.Name, isAdmin);
    }

    public static string? ResolveEmail(ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value
            ?? principal.FindFirst("preferred_username")?.Value
            ?? principal.FindFirst("upn")?.Value;
    }

    private bool IsLocalPasswordLoginEnabled() =>
        _hubOptions.AllowPasswordLogin || _hubOptions.AllowDevLogin;

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
