using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using LiotecnicaHub.Web.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public class CreateModel : PageModel
{
    private readonly IHubApplicationService _apps;
    private readonly IHubAppIconStorage _iconStorage;

    public CreateModel(IHubApplicationService apps, IHubAppIconStorage iconStorage)
    {
        _apps = apps;
        _iconStorage = iconStorage;
    }

    [BindProperty]
    public ApplicationInput Input { get; set; } = new();

    [BindProperty]
    public IFormFile? IconFile { get; set; }

    public AppIconUploadViewModel IconUpload { get; set; } = new();

    public SelectList EnvironmentOptions { get; set; } = null!;

    public void OnGet()
    {
        EnvironmentOptions = BuildEnvironmentSelect();
        IconUpload = new AppIconUploadViewModel { ApplicationName = Input.Name };
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        EnvironmentOptions = BuildEnvironmentSelect();
        IconUpload = new AppIconUploadViewModel { ApplicationName = Input.Name };

        if (!ModelState.IsValid)
            return Page();

        var app = new HubApplication
        {
            Name = Input.Name.Trim(),
            Description = Input.Description?.Trim(),
            LaunchUrl = Input.LaunchUrl.Trim(),
            Environment = Input.Environment,
            SortOrder = Input.SortOrder,
            IsActive = Input.IsActive
        };

        await _apps.CreateAsync(app, ct);

        if (!Input.RemoveIcon && IconFile is { Length: > 0 })
        {
            try
            {
                app.IconUrl = await _iconStorage.SaveAsync(app.Id, IconFile, null, ct);
                await _apps.UpdateAsync(app, ct);
            }
            catch (InvalidOperationException ex)
            {
                ModelState.AddModelError(string.Empty, ex.Message);
                Input.Id = app.Id;
                IconUpload = new AppIconUploadViewModel
                {
                    ApplicationId = app.Id,
                    ApplicationName = app.Name
                };
                return Page();
            }
        }

        return RedirectToPage("Index");
    }

    private static SelectList BuildEnvironmentSelect() =>
        new(Enum.GetValues<HubApplicationEnvironment>().Select(e => new
        {
            Value = (int)e,
            Text = e.ToString()
        }), "Value", "Text");
}
