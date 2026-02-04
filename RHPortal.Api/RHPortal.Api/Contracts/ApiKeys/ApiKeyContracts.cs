namespace RhPortal.Api.Contracts.ApiKeys;

public sealed class ApiKeyCreateRequest
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class ApiKeyResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? LastUsedAtUtc { get; set; }
}

/// <summary>
/// Returned only on create; the raw key is shown once and cannot be retrieved again.
/// </summary>
public sealed class ApiKeyCreateResponse : ApiKeyResponse
{
    /// <summary>
    /// The API key value. Store it securely; it will not be shown again.
    /// </summary>
    public string Key { get; set; } = default!;
}
