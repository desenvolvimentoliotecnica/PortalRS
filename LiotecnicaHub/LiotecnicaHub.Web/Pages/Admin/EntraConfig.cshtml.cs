using System.ComponentModel.DataAnnotations;
using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin;

public class EntraConfigModel : PageModel
{
    private readonly IHubEntraConfigService _entra;

    public EntraConfigModel(IHubEntraConfigService entra) => _entra = entra;

    [BindProperty]
    public EntraInput Input { get; set; } = new();

    public bool HasClientSecret { get; set; }
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync(CancellationToken ct)
    {
        var view = await _entra.GetAsync(ct);
        if (view is null) return;

        Input = new EntraInput
        {
            IsEnabled = view.IsEnabled,
            EntraTenantId = view.EntraTenantId,
            ClientId = view.ClientId,
            CallbackPath = view.CallbackPath,
            HubBaseUrl = view.HubBaseUrl
        };
        HasClientSecret = view.HasClientSecret;
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            var current = await _entra.GetAsync(ct);
            HasClientSecret = current?.HasClientSecret == true;
            return Page();
        }

        try
        {
            var saved = await _entra.SaveAsync(new HubEntraConfigDto
            {
                IsEnabled = Input.IsEnabled,
                EntraTenantId = Input.EntraTenantId,
                ClientId = Input.ClientId,
                ClientSecret = Input.ClientSecret,
                CallbackPath = Input.CallbackPath,
                HubBaseUrl = Input.HubBaseUrl
            }, ct);

            HasClientSecret = saved.HasClientSecret;
            StatusMessage = "Configuração salva com sucesso.";
            Input.ClientSecret = null;
            return Page();
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            var current = await _entra.GetAsync(ct);
            HasClientSecret = current?.HasClientSecret == true;
            return Page();
        }
    }

    public sealed class EntraInput
    {
        public bool IsEnabled { get; set; }

        [Display(Name = "Tenant ID (Entra)")]
        public string? EntraTenantId { get; set; }

        [Display(Name = "Client ID (App Registration)")]
        public string? ClientId { get; set; }

        [Display(Name = "Client Secret (deixe em branco para manter)")]
        public string? ClientSecret { get; set; }

        [Display(Name = "Redirect URI (callback)")]
        public string? CallbackPath { get; set; }

        [Display(Name = "URL base do Hub")]
        public string? HubBaseUrl { get; set; }
    }
}
