using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Users;

public class CreateModel : PageModel
{
    private readonly IHubAccessAdminService _admin;
    private readonly IHubPasswordService _passwords;

    public CreateModel(IHubAccessAdminService admin, IHubPasswordService passwords)
    {
        _admin = admin;
        _passwords = passwords;
    }

    [BindProperty]
    public HubUserInput Input { get; set; } = new();

    public IReadOnlyList<HubSelectOption> ApplicationOptions { get; private set; } = [];
    public string DefaultPasswordHint { get; private set; } = string.Empty;

    public async Task OnGetAsync(CancellationToken ct)
    {
        ApplicationOptions = await _admin.GetApplicationOptionsAsync(ct);
        DefaultPasswordHint = _passwords.GetDefaultPassword();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        ApplicationOptions = await _admin.GetApplicationOptionsAsync(ct);
        DefaultPasswordHint = _passwords.GetDefaultPassword();

        var result = await _admin.CreateUserAsync(Input, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível criar o usuário.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
