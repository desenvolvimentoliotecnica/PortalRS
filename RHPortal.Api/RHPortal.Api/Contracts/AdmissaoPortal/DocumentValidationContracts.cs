namespace RhPortal.Api.Contracts.AdmissaoPortal;

public sealed record DocumentValidationRequest(
    int TipoDocumento,
    string ImageBase64,
    string MediaType
);

public sealed record DocumentValidationResponse(
    bool IsValid,
    float Confidence,
    string DocumentType,
    Dictionary<string, string?> ExtractedFields,
    string? ValidationMessage
);
