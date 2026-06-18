using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Users;

public class EditModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public EditModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty]
    public HubUserInput Input { get; set; } = new();

    public IReadOnlyList<HubSelectOption> ProfileOptions { get; private set; } = [];

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        var user = await _admin.GetUserAsync(id, ct);
        if (user is null) return NotFound();

        Input = user;
        ProfileOptions = await _admin.GetProfileOptionsAsync(ct);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        ProfileOptions = await _admin.GetProfileOptionsAsync(ct);

        var result = await _admin.UpdateUserAsync(Input, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível atualizar o usuário.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
