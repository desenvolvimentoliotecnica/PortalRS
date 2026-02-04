namespace RhPortal.Api.Contracts.Common;

public sealed record OptionResponse(
    Guid Id,
    string Code,
    string Name
);
