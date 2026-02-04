using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class AccountController : Controller
{
    private readonly AuthApiClient _authApi;
    private readonly IConfiguration _configuration;

    public AccountController(AuthApiClient authApi, IConfiguration configuration)
    {
        _authApi = authApi;
        _configuration = configuration;
    }

    [AllowAnonymous]
    [HttpGet("/Account/Login")]
    public IActionResult Login([FromQuery] string? returnUrl = null, [FromQuery] string? error = null)
    {
        PrepareLoginViewData(error);
        return View(new LoginViewModel { ReturnUrl = returnUrl });
    }

    [AllowAnonymous]
    [HttpPost("/Account/Login")]
    public async Task<IActionResult> Login([FromForm] LoginViewModel model, [FromServices] OwnerAuthApiClient ownerAuthApi, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            PrepareLoginViewData();
            return View(model);
        }

        var tenantId = model.TenantId?.Trim().ToLowerInvariant() ?? string.Empty;

        if (string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
        {
            var ownerResponse = await ownerAuthApi.LoginAsync(model.Email.Trim(), model.Password, ct);
            if (ownerResponse is null)
            {
                ModelState.AddModelError(string.Empty, "Credenciais de owner inválidas.");
                PrepareLoginViewData();
                return View(model);
            }

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                AuthClaimsFactory.CreatePrincipalForOwner(ownerResponse),
                new AuthenticationProperties { IsPersistent = false });

            // Store Owner token in a separate cookie so api/owner/* still works after SwitchTenant
            Response.Cookies.Append("OwnerAccessToken", ownerResponse.AccessToken, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Secure = !HttpContext.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase),
                MaxAge = TimeSpan.FromMinutes(ownerResponse.AccessTokenExpirationMinutes)
            });

            var redirectUrl = string.IsNullOrWhiteSpace(model.ReturnUrl) ? "/Owner/Tenants" : model.ReturnUrl;
            return LocalRedirect(redirectUrl);
        }

        if (!TenantValidationMiddleware.IsValidTenantIdentifier(tenantId))
        {
            ModelState.AddModelError(nameof(model.TenantId), "Tenant invalido. Use apenas letras, numeros e hifen (ou 'owner' para proprietário).");
            PrepareLoginViewData();
            return View(model);
        }

        var response = await _authApi.LoginAsync(tenantId, model.Email.Trim(), model.Password, ct);
        if (response is null)
        {
            ModelState.AddModelError(string.Empty, "Invalid credentials.");
            PrepareLoginViewData();
            return View(model);
        }

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            AuthClaimsFactory.CreatePrincipal(response, tenantId),
            new AuthenticationProperties { IsPersistent = false });

        var url = string.IsNullOrWhiteSpace(model.ReturnUrl) ? "/" : model.ReturnUrl;
        return LocalRedirect(url);
    }

    [AllowAnonymous]
    [HttpGet("/Account/EntraLogin")]
    public IActionResult EntraLogin([FromQuery] string tenantId, [FromQuery] string? returnUrl = null)
    {
        if (!IsEntraConfigured())
            return RedirectToAction(nameof(Login), new { returnUrl, error = "entra" });

        if (!TenantValidationMiddleware.IsValidTenantIdentifier(tenantId))
            return RedirectToAction(nameof(Login), new { returnUrl, error = "tenant" });

        var redirectUrl = string.IsNullOrWhiteSpace(returnUrl) || !Url.IsLocalUrl(returnUrl)
            ? "/"
            : returnUrl;

        var props = new AuthenticationProperties
        {
            RedirectUri = redirectUrl
        };
        props.Items["tenant"] = tenantId.Trim().ToLowerInvariant();

        return Challenge(props, EntraIdDefaults.Scheme);
    }

    [HttpPost("/Account/Logout")]
    public async Task<IActionResult> Logout()
    {
        Response.Cookies.Delete("OwnerAccessToken", new CookieOptions { Path = "/" });
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
    }

    [HttpPost("/Account/SwitchTenant")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SwitchTenant([FromForm] string tenantId, [FromServices] MeApiClient meApi, CancellationToken ct)
    {
        if (User?.Identity?.IsAuthenticated != true || string.IsNullOrWhiteSpace(tenantId))
        {
            return RedirectToAction(nameof(Login));
        }

        var response = await meApi.SwitchTenantAsync(tenantId.Trim(), ct);
        if (response is null)
        {
            return BadRequest();
        }

        var newPrincipal = AuthClaimsFactory.CreatePrincipalWithSwitchedTenant(User, response.AccessToken, response.TenantId);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            newPrincipal,
            new AuthenticationProperties { IsPersistent = false });

        if (string.Equals(response.TenantId, "owner", StringComparison.OrdinalIgnoreCase))
            return LocalRedirect("/Owner/Tenants");
        return LocalRedirect("/Dashboard");
    }

    private void PrepareLoginViewData(string? error = null)
    {
        ViewData["EntraEnabled"] = IsEntraConfigured();
        if (!string.IsNullOrWhiteSpace(error))
            ViewData["EntraError"] = error;
    }

    private bool IsEntraConfigured()
    {
        var enabled = _configuration.GetValue<bool?>("EntraId:Enabled") ?? false;
        var clientId = _configuration["EntraId:ClientId"];
        return enabled && !string.IsNullOrWhiteSpace(clientId);
    }
}
