using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Users;

public class IndexModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public IndexModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty(SupportsGet = true)]
    public string? Search { get; set; }

    public IReadOnlyList<HubUserListItem> Users { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) =>
        Users = await _admin.ListUsersAsync(Search, ct);
}
