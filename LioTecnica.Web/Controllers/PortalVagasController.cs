using System.Security.Claims;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Portal;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace LioTecnica.Web.Controllers;

public sealed class PortalVagasController : Controller
{
    private readonly PortalAuthApiClient _portalAuthApi;
    private readonly PortalCandidatesApiClient _portalCandidatesApi;

    public PortalVagasController(PortalAuthApiClient portalAuthApi, PortalCandidatesApiClient portalCandidatesApi)
    {
        _portalAuthApi = portalAuthApi;
        _portalCandidatesApi = portalCandidatesApi;
    }

    [AllowAnonymous]
    [HttpGet("/PortalVagas")]
    public async Task<IActionResult> Index()
    {
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

    [Authorize(AuthenticationSchemes = CandidateAuthDefaults.Scheme)]
    [HttpPost("/PortalVagas/Logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CandidateAuthDefaults.Scheme);
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
            input.Uf.Trim().ToUpperInvariant());

        var result = await _portalCandidatesApi.UpdateProfileAsync(tenantId, candidateId, request, ct);
        if (!result.Success || result.Data is null)
            return StatusCode((int)result.StatusCode, new { message = result.Message ?? "Falha ao atualizar perfil." });

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
