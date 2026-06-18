using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Systems;

public class IndexModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public IndexModel(IHubAccessAdminService admin) => _admin = admin;

    public IReadOnlyList<HubSystemListItem> Systems { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) =>
        Systems = await _admin.ListSystemsAsync(ct);
}
