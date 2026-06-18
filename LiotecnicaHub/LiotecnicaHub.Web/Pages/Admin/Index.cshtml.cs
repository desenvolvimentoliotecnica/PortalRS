using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Pages.Admin;

public class IndexModel : PageModel
{
    private readonly HubDbContext _db;

    public IndexModel(HubDbContext db) => _db = db;

    public int ApplicationCount { get; set; }
    public int UserCount { get; set; }
    public int ProfileCount { get; set; }
    public int SystemCount { get; set; }
    public int AdminCount { get; set; }
    public bool EntraConfigured { get; set; }

    public async Task OnGetAsync(CancellationToken ct)
    {
        ApplicationCount = await _db.Applications.CountAsync(ct);
        UserCount = await _db.Users.CountAsync(ct);
        ProfileCount = await _db.Profiles.CountAsync(ct);
        SystemCount = await _db.Systems.CountAsync(ct);
        AdminCount = await _db.Admins.CountAsync(ct);
        EntraConfigured = await _db.EntraConfigs.AnyAsync(c => c.IsEnabled, ct);
    }
}
