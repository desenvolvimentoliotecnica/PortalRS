using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

public sealed record VagaListQuery(
    string? Q,
    VagaStatus? Status,
    /// <summary>Centro de custo — absorveu AreaId + DepartmentId em 31.2.</summary>
    Guid? CentroCustoId,
    Guid? RecrutadorUserId
);
