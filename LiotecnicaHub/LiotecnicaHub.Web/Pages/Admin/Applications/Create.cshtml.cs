using System.ComponentModel.DataAnnotations;
using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public class CreateModel : PageModel
{
    private readonly IHubApplicationService _apps;

    public CreateModel(IHubApplicationService apps) => _apps = apps;

    [BindProperty]
    public ApplicationInput Input { get; set; } = new();

    public SelectList EnvironmentOptions { get; set; } = null!;

    public void OnGet()
    {
        EnvironmentOptions = BuildEnvironmentSelect();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        EnvironmentOptions = BuildEnvironmentSelect();
        if (!ModelState.IsValid) return Page();

        var app = new HubApplication
        {
            Name = Input.Name.Trim(),
            Description = Input.Description?.Trim(),
            IconUrl = Input.IconUrl?.Trim(),
            LaunchUrl = Input.LaunchUrl.Trim(),
            Environment = Input.Environment,
            SortOrder = Input.SortOrder,
            IsActive = Input.IsActive
        };

        await _apps.CreateAsync(app, ct);
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
        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        [Url]
        public string? IconUrl { get; set; }

        [Required, MaxLength(2000)]
        public string LaunchUrl { get; set; } = string.Empty;

        public HubApplicationEnvironment Environment { get; set; } = HubApplicationEnvironment.Dev;
        public int SortOrder { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
