using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Auth;

[AllowAnonymous]
public class EntraCallbackModel : PageModel
{
    private readonly IHubEntraConfigService _entraConfig;
    private readonly IEntraChallengeService _challenge;
    private readonly IEntraTokenValidator _tokenValidator;
    private readonly IHubAuthService _authService;

    public EntraCallbackModel(
        IHubEntraConfigService entraConfig,
        IEntraChallengeService challenge,
        IEntraTokenValidator tokenValidator,
        IHubAuthService authService)
    {
        _entraConfig = entraConfig;
        _challenge = challenge;
        _tokenValidator = tokenValidator;
        _authService = authService;
    }

    public async Task<IActionResult> OnGetAsync(
        string? code,
        string? state,
        [FromQuery(Name = "error")] string? errorCode,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(errorCode))
            return RedirectToPage("/Login", new { error = errorCode });

        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            return RedirectToPage("/Login", new { error = "parametros_invalidos" });

        var payload = _challenge.TryDecodeState(state);
        if (payload is null)
            return RedirectToPage("/Login", new { error = "state_invalido" });

        var redirectUri = await _entraConfig.GetRedirectUriAsync(ct);
        if (string.IsNullOrWhiteSpace(redirectUri))
            return RedirectToPage("/Login", new { error = "nao_configurado" });

        var idToken = await _challenge.ExchangeCodeForIdTokenAsync(code, redirectUri, ct);
        if (string.IsNullOrWhiteSpace(idToken))
            return RedirectToPage("/Login", new { error = "troca_de_code_falhou" });

        var principal = await _tokenValidator.ValidateIdTokenAsync(idToken, ct);
        if (principal is null)
            return RedirectToPage("/Login", new { error = "usuario_nao_autenticado" });

        await _authService.SignInFromEntraPrincipalAsync(principal, ct);

        var returnUrl = string.IsNullOrWhiteSpace(payload.ReturnUrl) ? "/Apps" : payload.ReturnUrl;
        if (!Url.IsLocalUrl(returnUrl))
            returnUrl = "/Apps";

        return LocalRedirect(returnUrl);
    }
}
