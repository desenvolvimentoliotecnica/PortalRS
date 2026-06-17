using System.ComponentModel.DataAnnotations;
using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public class EditModel : PageModel
{
    private readonly IHubApplicationService _apps;

    public EditModel(IHubApplicationService apps) => _apps = apps;

    [BindProperty]
    public ApplicationInput Input { get; set; } = new();

    public SelectList EnvironmentOptions { get; set; } = null!;

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        var app = await _apps.GetByIdAsync(id, ct);
        if (app is null) return NotFound();

        Input = new ApplicationInput
        {
            Id = app.Id,
            Name = app.Name,
            Description = app.Description,
            IconUrl = app.IconUrl,
            LaunchUrl = app.LaunchUrl,
            Environment = app.Environment,
            SortOrder = app.SortOrder,
            IsActive = app.IsActive
        };

        EnvironmentOptions = BuildEnvironmentSelect();
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        EnvironmentOptions = BuildEnvironmentSelect();
        if (!ModelState.IsValid) return Page();

        var app = await _apps.GetByIdAsync(Input.Id, ct);
        if (app is null) return NotFound();

        app.Name = Input.Name.Trim();
        app.Description = Input.Description?.Trim();
        app.IconUrl = Input.IconUrl?.Trim();
        app.LaunchUrl = Input.LaunchUrl.Trim();
        app.Environment = Input.Environment;
        app.SortOrder = Input.SortOrder;
        app.IsActive = Input.IsActive;

        await _apps.UpdateAsync(app, ct);
        return RedirectToPage("Index");
    }

    private static SelectList BuildEnvironmentSelect() =>
        new(Enum.GetValues<HubApplicationEnvironment>().Select(e => new
        {
            Value = (int)e,
            Text = e.ToString()
        }), "Value", "Text");

    public sealed class ApplicationInput
    {
        public Guid Id { get; set; }

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        [Url]
        public string? IconUrl { get; set; }

        [Required, MaxLength(2000)]
        public string LaunchUrl { get; set; } = string.Empty;

        public HubApplicationEnvironment Environment { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
    }
}
