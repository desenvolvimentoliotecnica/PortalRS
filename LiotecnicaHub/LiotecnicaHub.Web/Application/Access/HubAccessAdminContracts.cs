namespace LiotecnicaHub.Web.Application.Access;

public sealed class HubUserListItem
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public int ApplicationCount { get; init; }
    public IReadOnlyList<string> ApplicationNames { get; init; } = [];
    public DateTimeOffset UpdatedAtUtc { get; init; }
}

public sealed class HubUserInput
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<Guid> SelectedApplicationIds { get; set; } = [];
}

public sealed class HubAuditListItem
{
    public Guid Id { get; init; }
    public string Action { get; init; } = string.Empty;
    public string ActionLabel { get; init; } = string.Empty;
    public DateTimeOffset OccurredAtUtc { get; init; }
    public string? AffectedUserEmail { get; init; }
    public string? ApplicationName { get; init; }
    public string? ChangedByEmail { get; init; }
    public string? PreviousData { get; init; }
    public string? NewData { get; init; }
}

public sealed class HubSelectOption
{
    public Guid Id { get; init; }
    public string Label { get; init; } = string.Empty;
    public string? Code { get; init; }
    public bool IsActive { get; init; } = true;
}

public interface IHubAccessAdminService
{
    Task<IReadOnlyList<HubUserListItem>> ListUsersAsync(string? search, CancellationToken ct);
    Task<HubUserInput?> GetUserAsync(Guid id, CancellationToken ct);
    Task<(bool Success, string? Error)> CreateUserAsync(HubUserInput input, CancellationToken ct);
    Task<(bool Success, string? Error)> UpdateUserAsync(HubUserInput input, CancellationToken ct);

    Task<IReadOnlyList<HubAuditListItem>> ListAuditsAsync(int take, CancellationToken ct);
    Task<IReadOnlyList<HubSelectOption>> GetApplicationOptionsAsync(CancellationToken ct);
    Task<IReadOnlyList<HubSelectOption>> GetSystemOptionsAsync(CancellationToken ct);
}
