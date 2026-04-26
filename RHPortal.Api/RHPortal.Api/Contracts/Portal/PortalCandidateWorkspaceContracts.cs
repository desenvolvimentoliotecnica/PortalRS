namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateCompletionResponse(
    IReadOnlyDictionary<string, int> Sections,
    int Overall,
    IReadOnlyList<string> Warnings,
    IReadOnlyDictionary<string, string> Evidence,
    IReadOnlyList<PortalCandidateCompletionSuggestion> Suggestions
);

public sealed record PortalCandidateCompletionSuggestion(
    string Section,
    string Text,
    string Impact
);

public sealed record PortalCandidateJobMatchesResponse(
    IReadOnlyList<PortalCandidateJobMatchItem> Matches
);

public sealed record PortalCandidateJobMatchItem(
    Guid VagaId,
    int Score,
    string? Title,
    string? Area,
    string? City,
    string? Uf,
    string? Mode,
    string? Level,
    string? Reason
);

public sealed record PortalCandidateResumeHtmlResponse(
    string FileName,
    string Html
);

public sealed record PortalCandidateResumePdfResponse(
    string FileName,
    string ContentType,
    string Base64
);
