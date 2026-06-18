using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public class DeleteModel : PageModel
{
    private readonly IHubApplicationService _apps;
    private readonly IHubAppIconStorage _iconStorage;

    public DeleteModel(IHubApplicationService apps, IHubAppIconStorage iconStorage)
    {
        _apps = apps;
        _iconStorage = iconStorage;
    }

    public HubApplication? Application { get; set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        Application = await _apps.GetByIdAsync(id, ct);
        return Application is null ? NotFound() : Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid id, CancellationToken ct)
    {
        var app = await _apps.GetByIdAsync(id, ct);
        if (app is null) return NotFound();

        await _iconStorage.RemoveAllForApplicationAsync(id, ct);
        await _apps.DeleteAsync(id, ct);
        return RedirectToPage("Index");
    }
}
