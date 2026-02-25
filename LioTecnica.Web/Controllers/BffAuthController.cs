using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[ApiController]
[Route("bff/auth")]
public sealed class BffAuthController : ControllerBase
{
    private readonly AuthApiClient _authApi;
    private readonly IConfiguration _configuration;

    public BffAuthController(AuthApiClient authApi, IConfiguration configuration)
    {
        _authApi = authApi;
        _configuration = configuration;
    }

    public sealed record LoginRequest(string TenantId, string Email, string Password, string? ReturnUrl);
    public sealed record SwitchTenantRequest(string TenantId, string? ReturnUrl);

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        [FromServices] OwnerAuthApiClient ownerAuthApi,
        CancellationToken ct)
    {
        if (request is null)
            return BadRequest(new { message = "Requisição inválida." });

        var tenantId = (request.TenantId ?? string.Empty).Trim().ToLowerInvariant();
        var email = (request.Email ?? string.Empty).Trim();
        var password = request.Password ?? string.Empty;

        if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return BadRequest(new { message = "Tenant, email e senha são obrigatórios." });

        if (string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
        {
            var ownerResponse = await ownerAuthApi.LoginAsync(email, password, ct);
            if (ownerResponse is null)
                return Unauthorized(new { message = "Credenciais de owner inválidas." });

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                AuthClaimsFactory.CreatePrincipalForOwner(ownerResponse),
                new AuthenticationProperties { IsPersistent = false });

            // Mantém compatibilidade com o legado (owner APIs dependem desse cookie).
            Response.Cookies.Append("OwnerAccessToken", ownerResponse.AccessToken, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Secure = !HttpContext.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase),
                MaxAge = TimeSpan.FromMinutes(ownerResponse.AccessTokenExpirationMinutes)
            });

            var redirectUrl = string.IsNullOrWhiteSpace(request.ReturnUrl) ? "/owner/tenants" : request.ReturnUrl;
            return Ok(new { ok = true, redirectUrl });
        }

        if (!TenantValidationMiddleware.IsValidTenantIdentifier(tenantId))
            return BadRequest(new { message = "Tenant inválido. Use apenas letras, números e hífen (ou 'owner')." });

        var response = await _authApi.LoginAsync(tenantId, email, password, ct);
        if (response is null)
            return Unauthorized(new { message = "Credenciais inválidas." });

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            AuthClaimsFactory.CreatePrincipal(response, tenantId),
            new AuthenticationProperties { IsPersistent = false });

        var url = string.IsNullOrWhiteSpace(request.ReturnUrl) ? "/dashboard" : request.ReturnUrl;
        return Ok(new { ok = true, redirectUrl = url });
    }

    [AllowAnonymous]
    [HttpGet("config")]
    public IActionResult Config()
    {
        var enabled = _configuration.GetValue<bool?>("EntraId:Enabled") ?? false;
        var clientId = _configuration["EntraId:ClientId"];
        var entraEnabled = enabled && !string.IsNullOrWhiteSpace(clientId);
        return Ok(new { entraEnabled });
    }

    [AllowAnonymous]
    [HttpGet("entra-login")]
    public IActionResult EntraLogin([FromQuery] string tenantId, [FromQuery] string? returnUrl = null)
    {
        // Mirror the legacy behavior: validate tenant and configuration, then redirect to legacy challenge endpoint.
        var enabled = _configuration.GetValue<bool?>("EntraId:Enabled") ?? false;
        var clientId = _configuration["EntraId:ClientId"];
        var entraEnabled = enabled && !string.IsNullOrWhiteSpace(clientId);
        if (!entraEnabled)
        {
            var errUrl = string.IsNullOrWhiteSpace(returnUrl)
                ? "/login?error=entra"
                : $"/login?error=entra&returnUrl={Uri.EscapeDataString(returnUrl)}";
            return Redirect(errUrl);
        }

        if (!TenantValidationMiddleware.IsValidTenantIdentifier(tenantId))
        {
            var errUrl = string.IsNullOrWhiteSpace(returnUrl)
                ? "/login?error=tenant"
                : $"/login?error=tenant&returnUrl={Uri.EscapeDataString(returnUrl)}";
            return Redirect(errUrl);
        }

        var safeReturn = string.IsNullOrWhiteSpace(returnUrl) ? "/" : returnUrl;
        var target =
            $"/Account/EntraLogin?tenantId={Uri.EscapeDataString(tenantId.Trim().ToLowerInvariant())}&returnUrl={Uri.EscapeDataString(safeReturn)}";
        return Redirect(target);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        Response.Cookies.Delete("OwnerAccessToken", new CookieOptions { Path = "/" });
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { ok = true });
    }

    [HttpPost("switch-tenant")]
    public async Task<IActionResult> SwitchTenant(
        [FromBody] SwitchTenantRequest request,
        [FromServices] MeApiClient meApi,
        CancellationToken ct)
    {
        if (request is null)
            return BadRequest(new { message = "Requisição inválida." });

        if (User?.Identity?.IsAuthenticated != true)
            return Unauthorized(new { message = "Não autenticado." });

        var tenantId = (request.TenantId ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(tenantId))
            return BadRequest(new { message = "TenantId é obrigatório." });

        var response = await meApi.SwitchTenantAsync(tenantId, ct);
        if (response is null)
            return BadRequest(new { message = "Não foi possível trocar o tenant." });

        var newPrincipal = AuthClaimsFactory.CreatePrincipalWithSwitchedTenant(User, response.AccessToken, response.TenantId);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            newPrincipal,
            new AuthenticationProperties { IsPersistent = false });

        var target = string.IsNullOrWhiteSpace(request.ReturnUrl)
            ? (string.Equals(response.TenantId, "owner", StringComparison.OrdinalIgnoreCase) ? "/owner/tenants" : "/dashboard")
            : request.ReturnUrl!;
        return Ok(new { ok = true, redirectUrl = target });
    }
}

