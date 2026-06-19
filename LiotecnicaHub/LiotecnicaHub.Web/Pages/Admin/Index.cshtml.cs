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
    public int AdminCount { get; set; }
    public bool EntraConfigured { get; set; }
    public bool LdapConfigured { get; set; }

    public async Task OnGetAsync(CancellationToken ct)
    {
        ApplicationCount = await _db.Applications.CountAsync(ct);
        UserCount = await _db.Users.CountAsync(ct);
        AdminCount = await _db.Admins.CountAsync(ct);
        EntraConfigured = await _db.EntraConfigs.AnyAsync(c => c.IsEnabled, ct);
        LdapConfigured = await _db.LdapConfigs.AnyAsync(c =>
            c.IsEnabled
            && c.Server != null && c.Server != ""
            && c.BaseDn != null && c.BaseDn != "", ct);
    }
}
