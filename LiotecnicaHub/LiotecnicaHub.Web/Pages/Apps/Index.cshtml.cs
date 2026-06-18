using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Domain.Entities;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Apps;

public class IndexModel : PageModel
{
    private readonly IHubApplicationService _apps;

    public IndexModel(IHubApplicationService apps) => _apps = apps;

    public IReadOnlyList<HubApplication> Applications { get; set; } = Array.Empty<HubApplication>();

    public async Task OnGetAsync(CancellationToken ct)
    {
        var email = User.FindFirst(HubClaimTypes.Email)?.Value;
        Applications = await _apps.GetVisibleForUserAsync(email, ct);
    }
}
