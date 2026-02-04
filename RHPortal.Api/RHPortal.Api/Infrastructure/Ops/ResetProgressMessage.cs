namespace RhPortal.Api.Infrastructure.Ops;

public sealed record ResetProgressMessage(
    string Stage,
    string Message,
    int? Percent,
    DateTimeOffset AtUtc
);
