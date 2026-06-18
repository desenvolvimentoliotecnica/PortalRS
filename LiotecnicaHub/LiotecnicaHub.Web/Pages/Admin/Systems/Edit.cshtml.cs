using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Systems;

public class EditModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public EditModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty]
    public HubSystemInput Input { get; set; } = new();

    public bool IsBuiltIn { get; private set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        var system = await _admin.GetSystemAsync(id, ct);
        if (system is null) return NotFound();

        Input = system;
        IsBuiltIn = HubBuiltInCatalog.IsBuiltInSystem(system.Code);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        var existing = await _admin.GetSystemAsync(Input.Id, ct);
        if (existing is null) return NotFound();

        IsBuiltIn = HubBuiltInCatalog.IsBuiltInSystem(existing.Code);

        var result = await _admin.UpdateSystemAsync(Input, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível atualizar o sistema.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
