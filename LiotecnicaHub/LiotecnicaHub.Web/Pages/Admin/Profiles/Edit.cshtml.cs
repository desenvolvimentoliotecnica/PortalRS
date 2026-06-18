using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Profiles;

public class EditModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public EditModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty]
    public HubProfileInput Input { get; set; } = new();

    public IReadOnlyList<HubSelectOption> SystemOptions { get; private set; } = [];
    public bool IsBuiltIn { get; private set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        var profile = await _admin.GetProfileAsync(id, ct);
        if (profile is null) return NotFound();

        Input = profile;
        IsBuiltIn = HubBuiltInCatalog.IsBuiltInProfile(profile.Code);
        SystemOptions = await _admin.GetSystemOptionsAsync(ct);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        var existing = await _admin.GetProfileAsync(Input.Id, ct);
        if (existing is null) return NotFound();

        IsBuiltIn = HubBuiltInCatalog.IsBuiltInProfile(existing.Code);
        SystemOptions = await _admin.GetSystemOptionsAsync(ct);

        var result = await _admin.UpdateProfileAsync(Input, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível atualizar o perfil.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
