namespace LioTecnica.Web.ViewModels.Admin;

public class ApiKeyViewModel
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? LastUsedAtUtc { get; set; }
}

public sealed class ApiKeyCreateRequest
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public sealed class ApiKeyCreateResponse : ApiKeyViewModel
{
    public string Key { get; set; } = default!;
}
