using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Infrastructure.Options;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;

namespace LiotecnicaHub.Web.Pages;

[AllowAnonymous]
public class LoginModel : PageModel
{
    private readonly IHubEntraConfigService _entraConfig;
    private readonly IEntraChallengeService _challenge;
    private readonly IHubAuthService _auth;
    private readonly HubOptions _hubOptions;

    public LoginModel(
        IHubEntraConfigService entraConfig,
        IEntraChallengeService challenge,
        IHubAuthService auth,
        IOptions<HubOptions> hubOptions)
    {
        _entraConfig = entraConfig;
        _challenge = challenge;
        _auth = auth;
        _hubOptions = hubOptions.Value;
    }

    [BindProperty]
    public string? LoginEmail { get; set; }

    [BindProperty]
    public string? LoginPassword { get; set; }

    public string? ErrorMessage { get; set; }
    public bool EntraEnabled { get; set; }
    public bool PasswordLoginEnabled { get; set; }

    public async Task<IActionResult> OnGetAsync(string? error, CancellationToken ct)
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToPage("/Apps/Index");

        ErrorMessage = MapError(error);
        await LoadLoginStateAsync(ct);
        return Page();
    }

    public async Task<IActionResult> OnPostPasswordAsync(CancellationToken ct)
    {
        if (!IsPasswordLoginEnabled())
            return NotFound();

        await LoadLoginStateAsync(ct);

        try
        {
            if (string.IsNullOrWhiteSpace(LoginEmail) || string.IsNullOrWhiteSpace(LoginPassword))
            {
                ErrorMessage = "Informe e-mail e senha.";
                return Page();
            }

            await _auth.SignInWithPasswordAsync(LoginEmail, LoginPassword, ct);
            return RedirectToPage("/Apps/Index");
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
            return Page();
        }
    }

    public async Task<IActionResult> OnGetMicrosoftAsync(string? returnUrl, CancellationToken ct)
    {
        var redirectUri = await _entraConfig.GetRedirectUriAsync(ct);
        if (string.IsNullOrWhiteSpace(redirectUri))
            return RedirectToPage(new { error = "nao_configurado" });

        var safeReturn = string.IsNullOrWhiteSpace(returnUrl) ? "/Apps" : returnUrl;
        var result = await _challenge.BuildAuthorizationUrlAsync(redirectUri, safeReturn, ct);
        if (result is null)
            return RedirectToPage(new { error = "nao_configurado" });

        return Redirect(result.Url);
    }

    public async Task<IActionResult> OnGetLogoutAsync()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToPage("/Login");
    }

    private async Task LoadLoginStateAsync(CancellationToken ct)
    {
        var config = await _entraConfig.GetDecryptedAsync(ct);
        EntraEnabled = config?.IsEnabled == true
            && !string.IsNullOrWhiteSpace(config.ClientId)
            && !string.IsNullOrWhiteSpace(config.EntraTenantId);

        PasswordLoginEnabled = IsPasswordLoginEnabled();
    }

    private bool IsPasswordLoginEnabled() =>
        _hubOptions.AllowPasswordLogin || _hubOptions.AllowDevLogin;

    private static string? MapError(string? code) => code switch
    {
        "nao_configurado" => "Login Microsoft não está configurado. Contate o administrador.",
        "parametros_invalidos" => "Parâmetros de retorno inválidos.",
        "state_invalido" => "Sessão de login expirada. Tente novamente.",
        "secret_ausente" =>
            "O client secret do Entra não está configurado. Entre com e-mail e senha, " +
            "vá em Configurações → Entra ID e salve o secret (Value) do Azure.",
        "secret_invalido" =>
            "Client secret inválido ou expirado. Entre com e-mail e senha, vá em Configurações → Entra ID " +
            "e salve um secret novo do Azure (use o Value, não o Secret ID).",
        "redirect_uri_invalido" =>
            "Redirect URI divergente do registrado no Azure. Em Configurações → Entra ID, use exatamente: " +
            "https://10.0.0.80:3010/Auth/EntraCallback",
        "troca_de_code_falhou" =>
            "Falha ao validar credenciais com a Microsoft. Verifique client secret e redirect URI no Admin → Entra ID.",
        "usuario_nao_autenticado" => "Não foi possível autenticar o usuário.",
        _ when !string.IsNullOrWhiteSpace(code) => $"Erro de autenticação: {code}",
        _ => null
    };
}
