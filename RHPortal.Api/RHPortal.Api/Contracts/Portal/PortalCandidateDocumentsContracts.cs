namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateDocumentDto(
    Guid Id,
    string Tipo,
    string Nome,
    string? Link,
    string? Data,
    string? Observacoes,
    string? FileName,
    DateTimeOffset CreatedAtUtc,
    /// <summary>True quando o binário foi enviado (upload) e pode ser baixado pela API de candidatos.</summary>
    bool TemArquivo = false
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
