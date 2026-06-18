using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Profiles;

public class DeleteModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public DeleteModel(IHubAccessAdminService admin) => _admin = admin;

    public HubProfileInput? Profile { get; private set; }
    public bool IsBuiltIn { get; private set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        Profile = await _admin.GetProfileAsync(id, ct);
        if (Profile is null) return NotFound();

        IsBuiltIn = HubBuiltInCatalog.IsBuiltInProfile(Profile.Code);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid id, CancellationToken ct)
    {
        Profile = await _admin.GetProfileAsync(id, ct);
        if (Profile is null) return NotFound();

        IsBuiltIn = HubBuiltInCatalog.IsBuiltInProfile(Profile.Code);

        var result = await _admin.DeleteProfileAsync(id, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível excluir o perfil.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
