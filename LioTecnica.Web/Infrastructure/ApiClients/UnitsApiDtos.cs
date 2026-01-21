using System.Text.Json.Serialization;

namespace RhPortal.Web.Infrastructure.ApiClients;

public sealed class UnitsPagedResponse
{
    [JsonPropertyName("items")]
    public List<UnitApiItem> Items { get; set; } = new();

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; }

    [JsonPropertyName("totalItems")]
    public int TotalItems { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}

public sealed class UnitApiItem
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; } // "Active", "Inactive"

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("uf")]
    public string? Uf { get; set; }

    // Se você adicionar no backend depois, já fica pronto:
    [JsonPropertyName("addressLine")]
    public string? AddressLine { get; set; }

    [JsonPropertyName("neighborhood")]
    public string? Neighborhood { get; set; }

    [JsonPropertyName("zipCode")]
    public string? ZipCode { get; set; }

    [JsonPropertyName("responsibleName")]
    public string? ResponsibleName { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}

public sealed class UnitResponse
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("uf")]
    public string? Uf { get; set; }

    [JsonPropertyName("addressLine")]
    public string? AddressLine { get; set; }

    [JsonPropertyName("neighborhood")]
    public string? Neighborhood { get; set; }

    [JsonPropertyName("zipCode")]
    public string? ZipCode { get; set; }

    [JsonPropertyName("responsibleName")]
    public string? ResponsibleName { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("createdAtUtc")]
    public DateTimeOffset CreatedAtUtc { get; set; }

    [JsonPropertyName("updatedAtUtc")]
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class UnitCreateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Status { get; set; }
    public string? City { get; set; }
    public string? Uf { get; set; }
    public string? AddressLine { get; set; }
    public string? Neighborhood { get; set; }
    public string? ZipCode { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? ResponsibleName { get; set; }
    public string? Type { get; set; }
    public int Headcount { get; set; }
    public string? Notes { get; set; }
}

public sealed class UnitUpdateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Status { get; set; }
    public string? City { get; set; }
    public string? Uf { get; set; }
    public string? AddressLine { get; set; }
    public string? Neighborhood { get; set; }
    public string? ZipCode { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? ResponsibleName { get; set; }
    public string? Type { get; set; }
    public int Headcount { get; set; }
    public string? Notes { get; set; }
}
