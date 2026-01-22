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
    public async Task<IActionResult> Login([FromForm] LoginViewModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            PrepareLoginViewData();
            return View(model);
        }

        var tenantId = model.TenantId.Trim().ToLowerInvariant();
        if (!TenantValidationMiddleware.IsValidTenantIdentifier(tenantId))
        {
            ModelState.AddModelError(nameof(model.TenantId), "Tenant invalido. Use apenas letras, numeros e hifen.");
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
            AuthClaimsFactory.CreatePrincipal(response),
            new AuthenticationProperties { IsPersistent = false });

        var redirectUrl = string.IsNullOrWhiteSpace(model.ReturnUrl) ? "/" : model.ReturnUrl;
        return LocalRedirect(redirectUrl);
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
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
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
