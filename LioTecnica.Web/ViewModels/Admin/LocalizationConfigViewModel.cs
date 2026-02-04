namespace LioTecnica.Web.ViewModels.Admin;

public sealed class LocalizationConfigViewModel
{
    public string? Culture { get; set; }
    public string? UiCulture { get; set; }
}

public sealed class LocalizationConfigRequest
{
    public string? Culture { get; set; }
    public string? UiCulture { get; set; }
}
