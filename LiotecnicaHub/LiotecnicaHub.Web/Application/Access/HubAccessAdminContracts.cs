namespace LiotecnicaHub.Web.Application.Access;

public sealed class HubUserListItem
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public int ProfileCount { get; init; }
    public IReadOnlyList<string> ProfileNames { get; init; } = [];
    public DateTimeOffset UpdatedAtUtc { get; init; }
}

public sealed class HubUserInput
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<Guid> SelectedProfileIds { get; set; } = [];
}

public sealed class HubProfileListItem
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public bool IsBuiltIn { get; set; }
    public int UserCount { get; init; }
    public int SystemAccessCount { get; init; }
}

public sealed class HubProfileInput
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Guid> SelectedSystemIds { get; set; } = [];
}

public sealed class HubSystemListItem
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public bool IsBuiltIn { get; set; }
    public int ApplicationCount { get; init; }
    public int ProfileAccessCount { get; init; }
}

public sealed class HubSystemInput
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Url { get; set; }
    public string? IconKey { get; set; }
    public bool IsActive { get; set; } = true;
    public bool RequiresApproval { get; set; }
}

public sealed class HubAuditListItem
{
    public Guid Id { get; init; }
    public string Action { get; init; } = string.Empty;
    public string ActionLabel { get; init; } = string.Empty;
    public DateTimeOffset OccurredAtUtc { get; init; }
    public string? AffectedUserEmail { get; init; }
    public string? ProfileCode { get; init; }
    public string? SystemCode { get; init; }
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

    Task<IReadOnlyList<HubProfileListItem>> ListProfilesAsync(CancellationToken ct);
    Task<HubProfileInput?> GetProfileAsync(Guid id, CancellationToken ct);
    Task<(bool Success, string? Error)> CreateProfileAsync(HubProfileInput input, CancellationToken ct);
    Task<(bool Success, string? Error)> UpdateProfileAsync(HubProfileInput input, CancellationToken ct);
    Task<(bool Success, string? Error)> DeleteProfileAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<HubSystemListItem>> ListSystemsAsync(CancellationToken ct);
    Task<HubSystemInput?> GetSystemAsync(Guid id, CancellationToken ct);
    Task<(bool Success, string? Error)> CreateSystemAsync(HubSystemInput input, CancellationToken ct);
    Task<(bool Success, string? Error)> UpdateSystemAsync(HubSystemInput input, CancellationToken ct);
    Task<(bool Success, string? Error)> DeleteSystemAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<HubAuditListItem>> ListAuditsAsync(int take, CancellationToken ct);
    Task<IReadOnlyList<HubSelectOption>> GetProfileOptionsAsync(CancellationToken ct);
    Task<IReadOnlyList<HubSelectOption>> GetSystemOptionsAsync(CancellationToken ct);
}
