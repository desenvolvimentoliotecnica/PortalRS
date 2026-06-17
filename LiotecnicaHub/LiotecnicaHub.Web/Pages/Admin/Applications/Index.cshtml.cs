using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Domain.Entities;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public class IndexModel : PageModel
{
    private readonly IHubApplicationService _apps;

    public IndexModel(IHubApplicationService apps) => _apps = apps;

    public IReadOnlyList<HubApplication> Applications { get; set; } = Array.Empty<HubApplication>();

    public async Task OnGetAsync(CancellationToken ct) =>
        Applications = await _apps.GetAllAsync(ct);
}
