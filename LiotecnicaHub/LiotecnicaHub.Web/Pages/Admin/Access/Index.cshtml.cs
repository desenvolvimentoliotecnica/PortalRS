using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Security.Claims;

namespace LiotecnicaHub.Web.Pages.Admin.Access;

public class IndexModel : PageModel
{
    private readonly IHubAccessCatalogService _catalog;

    public IndexModel(IHubAccessCatalogService catalog) => _catalog = catalog;

    public HubAccessCatalogSummary Summary { get; private set; } = new();
    public IReadOnlyList<string> CurrentUserSystemCodes { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct)
    {
        Summary = await _catalog.GetSummaryAsync(ct);

        var email = User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue("preferred_username");
        if (!string.IsNullOrWhiteSpace(email))
            CurrentUserSystemCodes = await _catalog.GetAccessibleSystemCodesForEmailAsync(email, ct);
    }
}
