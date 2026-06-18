using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Users;

public class CreateModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public CreateModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty]
    public HubUserInput Input { get; set; } = new();

    public IReadOnlyList<HubSelectOption> ApplicationOptions { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) =>
        ApplicationOptions = await _admin.GetApplicationOptionsAsync(ct);

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        ApplicationOptions = await _admin.GetApplicationOptionsAsync(ct);

        var result = await _admin.CreateUserAsync(Input, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível criar o usuário.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
