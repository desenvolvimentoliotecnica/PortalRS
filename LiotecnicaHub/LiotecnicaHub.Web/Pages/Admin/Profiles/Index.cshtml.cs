using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Profiles;

public class IndexModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public IndexModel(IHubAccessAdminService admin) => _admin = admin;

    public IReadOnlyList<HubProfileListItem> Profiles { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) =>
        Profiles = await _admin.ListProfilesAsync(ct);
}
