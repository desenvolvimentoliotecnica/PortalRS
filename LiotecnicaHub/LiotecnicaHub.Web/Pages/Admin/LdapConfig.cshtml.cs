using System.ComponentModel.DataAnnotations;
using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace LiotecnicaHub.Web.Pages.Admin;

public class LdapConfigModel : PageModel
{
    private const string StatusTempDataKey = "LdapConfigStatus";

    private readonly IHubLdapConfigService _ldap;
    private readonly IHubLdapAuthService _ldapAuth;

    public LdapConfigModel(IHubLdapConfigService ldap, IHubLdapAuthService ldapAuth)
    {
        _ldap = ldap;
        _ldapAuth = ldapAuth;
    }

    [BindProperty]
    public LdapInput Input { get; set; } = new();

    public bool HasBindPassword { get; set; }
    public string? StatusMessage { get; set; }
    public string? TestMessage { get; set; }
    public bool TestSuccess { get; set; }
    public IReadOnlyList<SelectListItem> LoginIdentityModes { get; private set; } = Array.Empty<SelectListItem>();

    public async Task OnGetAsync(CancellationToken ct)
    {
        BuildSelectLists();
        StatusMessage = TempData[StatusTempDataKey] as string;

        var view = await _ldap.GetAsync(ct);
        if (view is null) return;

        Input = MapInput(view);
        HasBindPassword = view.HasBindPassword;
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        BuildSelectLists();

        if (!ModelState.IsValid)
        {
            await LoadHasBindPasswordAsync(ct);
            return Page();
        }

        try
        {
            await _ldap.SaveAsync(MapDto(Input), ct);
            TempData[StatusTempDataKey] = "Configuração LDAP salva com sucesso.";
            return RedirectToPage();
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            await LoadHasBindPasswordAsync(ct);
            return Page();
        }
    }

    public async Task<IActionResult> OnPostTestAsync(CancellationToken ct)
    {
        BuildSelectLists();

        try
        {
            var saved = await _ldap.SaveAsync(MapDto(Input), ct);
            HasBindPassword = saved.HasBindPassword;
            Input.BindPassword = null;

            var dto = await _ldap.GetDecryptedAsync(ct) ?? MapDto(Input);
            var result = await _ldapAuth.TestConnectionAsync(dto, ct);
            TestSuccess = result.Success;
            TestMessage = result.Success
                ? $"{result.Message} Configuração salva no banco."
                : result.Message;
        }
        catch (InvalidOperationException ex)
        {
            TestSuccess = false;
            TestMessage = ex.Message;
            await LoadHasBindPasswordAsync(ct);
        }

        return Page();
    }

    private async Task LoadHasBindPasswordAsync(CancellationToken ct)
    {
        var current = await _ldap.GetAsync(ct);
        HasBindPassword = current?.HasBindPassword == true;
    }

    private void BuildSelectLists()
    {
        LoginIdentityModes =
        [
            new SelectListItem("E-mail (userPrincipalName)", HubLdapLoginIdentityMode.UserPrincipalName.ToString()),
            new SelectListItem("Domínio\\usuário (sAMAccountName)", HubLdapLoginIdentityMode.SamAccountName.ToString()),
            new SelectListItem("Buscar no diretório e autenticar", HubLdapLoginIdentityMode.SearchAndBind.ToString())
        ];
    }

    private static LdapInput MapInput(HubLdapConfigView view) => new()
    {
        IsEnabled = view.IsEnabled,
        Server = view.Server,
        Port = view.Port > 0 ? view.Port : 389,
        UseSsl = view.UseSsl,
        UseStartTls = view.UseStartTls,
        SkipServerCertificateValidation = view.SkipServerCertificateValidation,
        BaseDn = view.BaseDn,
        UserSearchBase = view.UserSearchBase,
        Domain = view.Domain,
        LoginIdentityMode = view.LoginIdentityMode,
        BindDn = view.BindDn,
        SearchFilterTemplate = view.SearchFilterTemplate,
        DisplayNameAttribute = view.DisplayNameAttribute
    };

    private static HubLdapConfigDto MapDto(LdapInput input) => new()
    {
        IsEnabled = input.IsEnabled,
        Server = input.Server,
        Port = input.Port > 0 ? input.Port : 389,
        UseSsl = input.UseSsl,
        UseStartTls = input.UseStartTls,
        SkipServerCertificateValidation = input.SkipServerCertificateValidation,
        BaseDn = input.BaseDn,
        UserSearchBase = input.UserSearchBase,
        Domain = input.Domain,
        LoginIdentityMode = input.LoginIdentityMode,
        BindDn = input.BindDn,
        BindPassword = input.BindPassword,
        SearchFilterTemplate = input.SearchFilterTemplate ?? string.Empty,
        DisplayNameAttribute = input.DisplayNameAttribute ?? "displayName"
    };

    public sealed class LdapInput
    {
        public bool IsEnabled { get; set; }

        [Display(Name = "Servidor LDAP")]
        public string? Server { get; set; }

        [Display(Name = "Porta")]
        public int Port { get; set; } = 389;

        [Display(Name = "Usar LDAPS (SSL)")]
        public bool UseSsl { get; set; }

        [Display(Name = "Usar StartTLS (porta 389)")]
        public bool UseStartTls { get; set; }

        [Display(Name = "Ignorar validação do certificado do servidor")]
        public bool SkipServerCertificateValidation { get; set; }

        [Display(Name = "Base DN")]
        public string? BaseDn { get; set; }

        [Display(Name = "Base de busca de usuários (opcional)")]
        public string? UserSearchBase { get; set; }

        [Display(Name = "Domínio Windows (NETBIOS)")]
        public string? Domain { get; set; }

        [Display(Name = "Formato de login")]
        public HubLdapLoginIdentityMode LoginIdentityMode { get; set; } = HubLdapLoginIdentityMode.UserPrincipalName;

        [Display(Name = "Conta de serviço (Bind DN)")]
        public string? BindDn { get; set; }

        [Display(Name = "Senha da conta de serviço (deixe em branco para manter)")]
        public string? BindPassword { get; set; }

        [Display(Name = "Filtro LDAP de busca")]
        public string? SearchFilterTemplate { get; set; }

        [Display(Name = "Atributo de nome exibido")]
        public string? DisplayNameAttribute { get; set; }
    }
}
