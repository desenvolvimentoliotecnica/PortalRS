using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Units;

public sealed record UnitCreateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(140)] string Name,
    UnitStatus Status,
    [MaxLength(120)] string? City,
    [MaxLength(2)] string? Uf,
    [MaxLength(220)] string? AddressLine,
    [MaxLength(120)] string? Neighborhood,
    [MaxLength(12)] string? ZipCode,
    [MaxLength(180), EmailAddress] string? Email,
    [MaxLength(40)] string? Phone,
    [MaxLength(140)] string? ResponsibleName,
    [MaxLength(120)] string? Type,
    int Headcount,
    [MaxLength(1000)] string? Notes
);

public sealed record UnitUpdateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(140)] string Name,
    UnitStatus Status,
    [MaxLength(120)] string? City,
    [MaxLength(2)] string? Uf,
    [MaxLength(220)] string? AddressLine,
    [MaxLength(120)] string? Neighborhood,
    [MaxLength(12)] string? ZipCode,
    [MaxLength(180), EmailAddress] string? Email,
    [MaxLength(40)] string? Phone,
    [MaxLength(140)] string? ResponsibleName,
    [MaxLength(120)] string? Type,
    int Headcount,
    [MaxLength(1000)] string? Notes
);

public sealed record UnitResponse(
    Guid Id,
    string Code,
    string Name,
    UnitStatus Status,
    string? City,
    string? Uf,
    string? AddressLine,
    string? Neighborhood,
    string? ZipCode,
    string? Email,
    string? Phone,
    string? ResponsibleName,
    string? Type,
    int Headcount,
    string? Notes,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
