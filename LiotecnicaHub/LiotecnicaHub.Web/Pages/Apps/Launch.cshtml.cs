using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Apps;

public class LaunchModel : PageModel
{
    private readonly IHubApplicationService _apps;
    private readonly IHubLaunchService _launch;

    public LaunchModel(IHubApplicationService apps, IHubLaunchService launch)
    {
        _apps = apps;
        _launch = launch;
    }

    public string FallbackUrl { get; private set; } = "/Apps";

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        var email = HubAuthService.ResolveEmail(User);
        if (string.IsNullOrWhiteSpace(email))
            return RedirectToPage("/Login");

        var app = await _apps.GetByIdAsync(id, ct);
        if (app is null || !app.IsActive)
            return NotFound();

        if (!HubApplicationService.IsVisibleToUser(app, email))
            return Forbid();

        var url = _launch.BuildLaunchUrl(app, email);
        FallbackUrl = url;
        return Redirect(url);
    }
}
