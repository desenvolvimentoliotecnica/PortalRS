namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateDocumentDto(
    Guid Id,
    string Tipo,
    string Nome,
    string? Link,
    string? Data,
    string? Observacoes,
    string? FileName,
    DateTimeOffset CreatedAtUtc
);

public sealed record PortalCandidateDocumentsResponse(
    IReadOnlyList<PortalCandidateDocumentDto> Items
);

public sealed record PortalCandidateDocumentRequest(
    string Tipo,
    string Nome,
    string? Link,
    string? Data,
    string? Observacoes,
    string? FileName
);
