using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

public sealed record VagaListQuery(
    string? Q,
    VagaStatus? Status,
    Guid? AreaId,
    Guid? DepartmentId,
    Guid? RecrutadorUserId
);
