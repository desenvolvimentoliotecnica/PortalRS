using System.Security.Claims;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Portal;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace LioTecnica.Web.Controllers;

public sealed class PortalVagasController : Controller
{
    private readonly AuthApiClient _authApi;
    private readonly PortalAuthApiClient _portalAuthApi;
    private readonly PortalCandidatesApiClient _portalCandidatesApi;

    public PortalVagasController(
        AuthApiClient authApi,
        PortalAuthApiClient portalAuthApi,
        PortalCandidatesApiClient portalCandidatesApi)
    {
        _authApi = authApi;
        _portalAuthApi = portalAuthApi;
        _portalCandidatesApi = portalCandidatesApi;
    }

    [AllowAnonymous]
    [HttpGet("/PortalVagas")]
    public async Task<IActionResult> Index()
    {
        var systemAuth = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (systemAuth.Succeeded && systemAuth.Principal?.Identity?.IsAuthenticated == true)
        {
            if (systemAuth.Principal.IsInRole("Admin"))
            {
                HttpContext.User = systemAuth.Principal;
                return View();
            }
        }

        var auth = await HttpContext.AuthenticateAsync(CandidateAuthDefaults.Scheme);
        if (!auth.Succeeded || auth.Principal?.Identity?.IsAuthenticated != true)
        {
            return Challenge(
                new AuthenticationProperties { RedirectUri = $"{Request.Path}{Request.QueryString}" },
                CandidateAuthDefaults.Scheme);
        }

        HttpContext.User = auth.Principal!;
        return View();
    }

    [AllowAnonymous]
    [HttpGet("/PortalVagas/Acesso")]
    public async Task<IActionResult> Access([FromQuery] string? tenantId = null, [FromQuery] string? returnUrl = null)
    {
        var resolvedTenantId = ResolveTenantId(tenantId, returnUrl);
        var systemAuth = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (systemAuth.Succeeded && systemAuth.Principal?.Identity?.IsAuthenticated == true
            && systemAuth.Principal.IsInRole("Admin"))
        {
            var tenantFromClaim = systemAuth.Principal.FindFirst("tenant")?.Value?.Trim();
            var redirect = BuildRedirectUrl(returnUrl, resolvedTenantId ?? tenantFromClaim);
            return LocalRedirect(redirect);
        }

        var auth = await HttpContext.AuthenticateAsync(CandidateAuthDefaults.Scheme);
        if (auth.Succeeded && auth.Principal?.Identity?.IsAuthenticated == true)
        {
            var tenantFromClaim = auth.Principal.FindFirst("tenant")?.Value?.Trim();
            var redirect = BuildRedirectUrl(returnUrl, resolvedTenantId ?? tenantFromClaim);
            return LocalRedirect(redirect);
        }

        return View("Acesso", new PortalAccessViewModel
        {
            TenantId = resolvedTenantId ?? string.Empty,
            ReturnUrl = returnUrl
        });
    }

    [Authorize(AuthenticationSchemes = CandidateAuthDefaults.Scheme + "," + CookieAuthenticationDefaults.AuthenticationScheme)]
    [HttpPost("/PortalVagas/Logout")]
    public async Task<IActionResult> Logout([FromQuery] string? tenantId = null)
    {
        var resolvedTenantId = ResolveTenantId(tenantId, null)
            ?? User?.FindFirst("tenant")?.Value?.Trim();

        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignOutAsync(CandidateAuthDefaults.Scheme);

        if (!string.IsNullOrWhiteSpace(resolvedTenantId))
        {
            var encoded = Uri.EscapeDataString(resolvedTenantId);
            return Redirect($"/PortalVagas/Acesso?tenantId={encoded}");
        }

        return Redirect("/PortalVagas/Acesso");
    }

    [Authorize(AuthenticationSchemes = CandidateAuthDefaults.Scheme)]
    [HttpGet("/PortalVagas/Profile")]
    public async Task<IActionResult> GetProfile(CancellationToken ct)
    {
        if (!TryGetCandidateContext(out var candidateId, out var tenantId, out var error))
            return error;

        var result = await _portalCandidatesApi.GetProfileAsync(tenantId, candidateId, ct);
        if (!result.Success || result.Data is null)
            return StatusCode((int)result.StatusCode, new { message = result.Message ?? "Falha ao carregar perfil." });

        return Ok(result.Data);
    }

    [Authorize(AuthenticationSchemes = CandidateAuthDefaults.Scheme)]
    [HttpPut("/PortalVagas/Profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] PortalCandidateProfileUpdateInput input, CancellationToken ct)
    {
        if (input is null)
            return BadRequest(new { message = "Requisicao invalida." });

        if (!ModelState.IsValid)
            return BadRequest(new { message = "Dados invalidos. Revise os campos e tente novamente." });

        if (!TryGetCandidateContext(out var candidateId, out var tenantId, out var error))
            return error;

        var request = new PortalCandidateProfileUpdateRequest(
            input.Nome.Trim(),
            input.Fone.Trim(),
            input.Cidade.Trim(),
            input.Uf.Trim().ToUpperInvariant(),
            string.IsNullOrWhiteSpace(input.LinkedinUrl) ? null : input.LinkedinUrl.Trim(),
            string.IsNullOrWhiteSpace(input.ResumoProfissional) ? null : input.ResumoProfissional.Trim());

        var result = await _portalCandidatesApi.UpdateProfileAsync(tenantId, candidateId, request, ct);
        if (!result.Success || result.Data is null)
            return StatusCode((int)result.StatusCode, new { message = result.Message ?? "Falha ao atualizar perfil." });

        return Ok(result.Data);
    }

    [Authorize(AuthenticationSchemes = CandidateAuthDefaults.Scheme)]
    [HttpPost("/PortalVagas/Profile/Avatar")]
    public async Task<IActionResult> UploadAvatar([FromForm(Name = "arquivo")] IFormFile arquivo, CancellationToken ct)
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo invalido." });

        if (!TryGetCandidateContext(out var candidateId, out var tenantId, out var error))
            return error;

        var result = await _portalCandidatesApi.UploadAvatarAsync(tenantId, candidateId, arquivo, ct);
        if (!result.Success || result.Data is null)
            return StatusCode((int)result.StatusCode, new { message = result.Message ?? "Falha ao enviar avatar." });

        return Ok(result.Data);
    }

    [Authorize(AuthenticationSchemes = CandidateAuthDefaults.Scheme)]
    [HttpPost("/PortalVagas/Profile/Curriculo")]
    public async Task<IActionResult> UploadCurriculo([FromForm(Name = "arquivo")] IFormFile arquivo, CancellationToken ct)
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo invalido." });

        if (!TryGetCandidateContext(out var candidateId, out var tenantId, out var error))
            return error;

        var result = await _portalCandidatesApi.UploadCurriculoAsync(tenantId, candidateId, arquivo, ct);
        if (!result.Success || result.Data is null)
            return StatusCode((int)result.StatusCode, new { message = result.Message ?? "Falha ao enviar curriculo." });

        return Ok(result.Data);
    }

    [AllowAnonymous]
    [HttpPost("/PortalVagas/Auth/Login")]
    public async Task<IActionResult> Login([FromBody] PortalCandidateLoginInput input, CancellationToken ct)
    {
        if (input is null)
            return BadRequest(new { message = "Requisicao invalida." });

        if (string.IsNullOrWhiteSpace(input.TenantId))
            return BadRequest(new { message = "Tenant nao informado. Verifique o link de acesso." });

        if (!ModelState.IsValid)
            return BadRequest(new { message = "Dados invalidos. Revise os campos e tente novamente." });

        var tenantId = NormalizeTenantId(input.TenantId);
        if (!TenantValidationMiddleware.IsValidTenantIdentifier(tenantId))
            return BadRequest(new { message = "Tenant invalido. Verifique o link de acesso." });

        var systemResponse = await _authApi.LoginAsync(tenantId, input.Email.Trim(), input.Password, ct);
        if (systemResponse is not null)
        {
            var isAdmin = systemResponse.Roles?.Any(role => string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)) == true;
            if (!isAdmin)
                return StatusCode(403, new { message = "Acesso permitido apenas para administradores." });

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                AuthClaimsFactory.CreatePrincipal(systemResponse),
                new AuthenticationProperties { IsPersistent = false });

            var adminRedirect = BuildRedirectUrl(input.ReturnUrl, tenantId);
            return Ok(new { redirectUrl = adminRedirect, nome = systemResponse.FullName, email = systemResponse.Email });
        }

        var request = new PortalCandidateLoginRequest(input.Email.Trim(), input.Password);
        var result = await _portalAuthApi.LoginAsync(tenantId, request, ct);
        if (!result.Success || result.Data is null)
            return StatusCode((int)result.StatusCode, new { message = result.Message ?? "Falha ao autenticar candidato." });

        await SignInCandidateAsync(result.Data, tenantId);

        var redirect = BuildRedirectUrl(input.ReturnUrl, tenantId);
        return Ok(new PortalCandidateAuthUiResponse(redirect, result.Data.Nome, result.Data.Email));
    }

    [AllowAnonymous]
    [HttpPost("/PortalVagas/Auth/Register")]
    public async Task<IActionResult> Register([FromBody] PortalCandidateRegisterInput input, CancellationToken ct)
    {
        if (input is null)
            return BadRequest(new { message = "Requisicao invalida." });

        if (string.IsNullOrWhiteSpace(input.TenantId))
            return BadRequest(new { message = "Tenant nao informado. Verifique o link de acesso." });

        if (!ModelState.IsValid)
            return BadRequest(new { message = "Dados invalidos. Revise os campos e tente novamente." });

        var tenantId = NormalizeTenantId(input.TenantId);
        if (!TenantValidationMiddleware.IsValidTenantIdentifier(tenantId))
            return BadRequest(new { message = "Tenant invalido. Verifique o link de acesso." });

        var request = new PortalCandidateRegisterRequest(
            input.Nome.Trim(),
            input.Email.Trim(),
            input.Fone.Trim(),
            input.Cidade.Trim(),
            input.Uf.Trim().ToUpperInvariant(),
            input.Password);

        var result = await _portalAuthApi.RegisterAsync(tenantId, request, ct);
        if (!result.Success || result.Data is null)
            return StatusCode((int)result.StatusCode, new { message = result.Message ?? "Falha ao cadastrar acesso." });

        await SignInCandidateAsync(result.Data, tenantId);

        var redirect = BuildRedirectUrl(input.ReturnUrl, tenantId);
        return Ok(new PortalCandidateAuthUiResponse(redirect, result.Data.Nome, result.Data.Email));
    }

    private async Task SignInCandidateAsync(PortalCandidateAuthResponse data, string tenantId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, data.Id.ToString()),
            new(ClaimTypes.Email, data.Email),
            new(ClaimTypes.Name, data.Nome),
            new("tenant", tenantId)
        };

        var identity = new ClaimsIdentity(claims, CandidateAuthDefaults.Scheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(
            CandidateAuthDefaults.Scheme,
            principal,
            new AuthenticationProperties { IsPersistent = false });
    }

    private static string NormalizeTenantId(string tenantId)
        => (tenantId ?? string.Empty).Trim().ToLowerInvariant();

    private bool TryGetCandidateContext(out Guid candidateId, out string tenantId, out IActionResult error)
    {
        candidateId = Guid.Empty;
        tenantId = string.Empty;

        var idValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(idValue, out candidateId))
        {
            error = Unauthorized(new { message = "Sessao expirada. Entre novamente." });
            return false;
        }

        tenantId = User.FindFirst("tenant")?.Value?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            error = Unauthorized(new { message = "Tenant invalido. Entre novamente." });
            return false;
        }

        error = new EmptyResult();
        return true;
    }

    private string BuildRedirectUrl(string? returnUrl, string? tenantId)
    {
        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
            return returnUrl;

        if (!string.IsNullOrWhiteSpace(tenantId))
            return $"/PortalVagas?tenantId={Uri.EscapeDataString(tenantId)}";

        return "/PortalVagas";
    }

    private static string? ResolveTenantId(string? tenantId, string? returnUrl)
    {
        var trimmed = string.IsNullOrWhiteSpace(tenantId) ? string.Empty : tenantId.Trim();
        if (!string.IsNullOrWhiteSpace(trimmed))
            return trimmed.ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(returnUrl))
            return null;

        if (!Uri.TryCreate("http://local" + returnUrl, UriKind.Absolute, out var uri))
            return null;

        var query = QueryHelpers.ParseQuery(uri.Query);
        if (!query.TryGetValue("tenantId", out var value))
            return null;

        return value.ToString().Trim().ToLowerInvariant();
    }
}
