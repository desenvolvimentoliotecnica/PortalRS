using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public class DeleteModel : PageModel
{
    private readonly IHubApplicationService _apps;

    public DeleteModel(IHubApplicationService apps) => _apps = apps;

    public HubApplication? Application { get; set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        Application = await _apps.GetByIdAsync(id, ct);
        return Application is null ? NotFound() : Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid id, CancellationToken ct)
    {
        await _apps.DeleteAsync(id, ct);
        return RedirectToPage("Index");
    }
}
