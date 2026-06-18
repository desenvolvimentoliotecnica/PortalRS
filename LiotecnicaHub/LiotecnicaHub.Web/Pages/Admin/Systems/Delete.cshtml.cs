using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Systems;

public class DeleteModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public DeleteModel(IHubAccessAdminService admin) => _admin = admin;

    public HubSystemInput? System { get; private set; }
    public bool IsBuiltIn { get; private set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        System = await _admin.GetSystemAsync(id, ct);
        if (System is null) return NotFound();

        IsBuiltIn = HubBuiltInCatalog.IsBuiltInSystem(System.Code);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid id, CancellationToken ct)
    {
        System = await _admin.GetSystemAsync(id, ct);
        if (System is null) return NotFound();

        IsBuiltIn = HubBuiltInCatalog.IsBuiltInSystem(System.Code);

        var result = await _admin.DeleteSystemAsync(id, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível excluir o sistema.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
