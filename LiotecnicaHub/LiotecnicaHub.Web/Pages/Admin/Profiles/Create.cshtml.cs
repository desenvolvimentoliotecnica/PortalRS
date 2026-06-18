using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Profiles;

public class CreateModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public CreateModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty]
    public HubProfileInput Input { get; set; } = new();

    public IReadOnlyList<HubSelectOption> SystemOptions { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) =>
        SystemOptions = await _admin.GetSystemOptionsAsync(ct);

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        SystemOptions = await _admin.GetSystemOptionsAsync(ct);

        var result = await _admin.CreateProfileAsync(Input, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível criar o perfil.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
