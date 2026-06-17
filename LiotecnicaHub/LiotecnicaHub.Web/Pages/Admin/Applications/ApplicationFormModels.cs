using System.ComponentModel.DataAnnotations;
using LiotecnicaHub.Web.Domain.Enums;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public sealed class ApplicationInput
{
    public Guid Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(500)]
    public string? IconUrl { get; set; }

    public bool RemoveIcon { get; set; }

    [Required, MaxLength(2000)]
    public string LaunchUrl { get; set; } = string.Empty;

    public HubApplicationEnvironment Environment { get; set; } = HubApplicationEnvironment.Dev;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class AppIconUploadViewModel
{
    public Guid? ApplicationId { get; set; }
    public string? CurrentIconUrl { get; set; }
    public string ApplicationName { get; set; } = string.Empty;
}
