namespace RhPortal.Api.Contracts.Common;

public sealed record PagedResult<T>(
    List<T> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages
);
