using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Domain.Enums;
using LiotecnicaHub.Web.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public class EditModel : PageModel
{
    private readonly IHubApplicationService _apps;
    private readonly IHubAppIconStorage _iconStorage;
    private readonly IHubAccessAdminService _admin;

    public EditModel(
        IHubApplicationService apps,
        IHubAppIconStorage iconStorage,
        IHubAccessAdminService admin)
    {
        _apps = apps;
        _iconStorage = iconStorage;
        _admin = admin;
    }

    [BindProperty]
    public ApplicationInput Input { get; set; } = new();

    [BindProperty]
    public IFormFile? IconFile { get; set; }

    public AppIconUploadViewModel IconUpload { get; set; } = new();

    public SelectList EnvironmentOptions { get; set; } = null!;
    public SelectList SystemOptions { get; set; } = null!;

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        var app = await _apps.GetByIdAsync(id, ct);
        if (app is null) return NotFound();

        Input = MapToInput(app);
        IconUpload = BuildIconUpload(app);
        EnvironmentOptions = BuildEnvironmentSelect();
        SystemOptions = await BuildSystemSelectAsync(ct);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        EnvironmentOptions = BuildEnvironmentSelect();
        SystemOptions = await BuildSystemSelectAsync(ct);

        var app = await _apps.GetByIdAsync(Input.Id, ct);
        if (app is null) return NotFound();

        IconUpload = BuildIconUpload(app);

        if (!ModelState.IsValid)
            return Page();

        app.Name = Input.Name.Trim();
        app.Description = Input.Description?.Trim();
        app.LaunchUrl = Input.LaunchUrl.Trim();
        app.Environment = Input.Environment;
        app.SortOrder = Input.SortOrder;
        app.IsActive = Input.IsActive;
        app.SystemId = NormalizeSystemId(Input.SystemId);

        await ApplicationIconFormHelper.ApplyIconChangesAsync(
            app, Input, IconFile, _iconStorage, ModelState, ct);

        if (!ModelState.IsValid)
            return Page();

        await _apps.UpdateAsync(app, ct);
        return RedirectToPage("Index");
    }

    private static ApplicationInput MapToInput(Domain.Entities.HubApplication app) => new()
    {
        Id = app.Id,
        Name = app.Name,
        Description = app.Description,
        IconUrl = app.IconUrl,
        LaunchUrl = app.LaunchUrl,
        Environment = app.Environment,
        SortOrder = app.SortOrder,
        IsActive = app.IsActive,
        SystemId = app.SystemId
    };

    private static AppIconUploadViewModel BuildIconUpload(Domain.Entities.HubApplication app) => new()
    {
        ApplicationId = app.Id,
        ApplicationName = app.Name,
        CurrentIconUrl = app.IconUrl
    };

    private static SelectList BuildEnvironmentSelect() =>
        new(Enum.GetValues<HubApplicationEnvironment>().Select(e => new
        {
            Value = (int)e,
            Text = e.ToString()
        }), "Value", "Text");

    private async Task<SelectList> BuildSystemSelectAsync(CancellationToken ct)
    {
        var systems = await _admin.GetSystemOptionsAsync(ct);
        var items = systems
            .Select(s => new { s.Id, Text = $"{s.Label} ({s.Code})" })
            .Prepend(new { Id = Guid.Empty, Text = "— Sem vínculo IAM —" })
            .ToList();

        return new SelectList(items, "Id", "Text", Input.SystemId ?? Guid.Empty);
    }

    private static Guid? NormalizeSystemId(Guid? systemId) =>
        systemId is null || systemId.Value == Guid.Empty ? null : systemId;
}
