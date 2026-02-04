using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Units;

public sealed record UnitGridRowResponse(
    Guid Id,
    string Name,
    string Code,
    UnitStatus Status,
    int Headcount,
    string? Email,
    string? Phone,
    string? Type,
    string? City,
    string? Uf,

    string? AddressLine,
    string? Neighborhood,
    string? ZipCode,
    string? ResponsibleName,
    string? Notes
);
