using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Audit;

public class IndexModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public IndexModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty(SupportsGet = true)]
    public int Take { get; set; } = 100;

    public IReadOnlyList<HubAuditListItem> Audits { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken ct) =>
        Audits = await _admin.ListAuditsAsync(Take, ct);
}
