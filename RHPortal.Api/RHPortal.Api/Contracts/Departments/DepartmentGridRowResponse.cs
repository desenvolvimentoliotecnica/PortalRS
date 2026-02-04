using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Departments;

public sealed record DepartmentGridRowResponse(
    Guid Id,
    string Name,
    string Code,
    string? ManagerName,
    string? ManagerEmail,
    string? Location,
    int Headcount,
    DepartmentStatus Status,
    int VacanciesOpen,
    int VacanciesTotal
);
