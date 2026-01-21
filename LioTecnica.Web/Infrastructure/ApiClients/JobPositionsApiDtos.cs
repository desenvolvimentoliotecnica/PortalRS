using System.Text.Json.Serialization;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class JobPositionsPagedResponse
{
    [JsonPropertyName("items")]
    public List<JobPositionGridRowApiItem> Items { get; set; } = new();

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; }

    [JsonPropertyName("totalItems")]
    public int TotalItems { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}

public sealed class JobPositionGridRowApiItem
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("areaName")]
    public string? AreaName { get; set; }

    [JsonPropertyName("areaId")]
    public Guid AreaId { get; set; }

    [JsonPropertyName("seniority")]
    public string? Seniority { get; set; }

    [JsonPropertyName("managersCount")]
    public int ManagersCount { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }
}

public sealed class JobPositionResponse
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("areaId")]
    public Guid AreaId { get; set; }

    [JsonPropertyName("areaName")]
    public string? AreaName { get; set; }

    [JsonPropertyName("seniority")]
    public string? Seniority { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("createdAtUtc")]
    public DateTimeOffset CreatedAtUtc { get; set; }

    [JsonPropertyName("updatedAtUtc")]
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class JobPositionCreateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Status { get; set; }
    public Guid? AreaId { get; set; }
    public string? Seniority { get; set; }
    public string? Type { get; set; }
    public string? Description { get; set; }
}

public sealed class JobPositionUpdateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Status { get; set; }
    public Guid? AreaId { get; set; }
    public string? Seniority { get; set; }
    public string? Type { get; set; }
    public string? Description { get; set; }
}

public sealed class JobPositionLookupItem
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }
}
