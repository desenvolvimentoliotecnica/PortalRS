using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Candidates;

public sealed record CandidateCreateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    [Required] Guid VagaId,
    [MaxLength(2000)] string? Obs,
    string? CvText,
    CandidateMatchRequest? LastMatch,
    IReadOnlyList<CandidateDocumentoRequest>? Documentos
);

public sealed record CandidateUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    [Required] Guid VagaId,
    [MaxLength(2000)] string? Obs,
    string? CvText,
    CandidateMatchRequest? LastMatch,
    IReadOnlyList<CandidateDocumentoRequest>? Documentos,
    CandidateStatusChangeRequest? StatusChange
);

public sealed record CandidateListItemResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    Guid? VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    string? Obs,
    string? CvText,
    CandidateMatchResponse? LastMatch,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CandidateResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    Guid? VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    string? Obs,
    string? CvText,
    CandidateMatchResponse? LastMatch,
    IReadOnlyList<CandidateDocumentoResponse> Documentos,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CandidateMatchRequest(
    int? Score,
    bool? Pass,
    DateTimeOffset? AtUtc,
    Guid? VagaId
);

public sealed record CandidateMatchResponse(
    int? Score,
    bool? Pass,
    DateTimeOffset? AtUtc,
    Guid? VagaId
);

public sealed record CandidateDocumentoRequest(
    CandidateDocumentType Tipo,
    [Required, MaxLength(200)] string NomeArquivo,
    [MaxLength(120)] string? ContentType,
    [MaxLength(240)] string? Descricao,
    long? TamanhoBytes,
    [MaxLength(400)] string? Url
);

public sealed record CandidateDocumentoUploadRequest(
    [Required] string Tipo,
    [MaxLength(240)] string? Descricao,
    [Required] IFormFile Arquivo
);

public sealed record CandidateDocumentoResponse(
    Guid Id,
    CandidateDocumentType Tipo,
    string NomeArquivo,
    string? ContentType,
    string? Descricao,
    long? TamanhoBytes,
    string? Url,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CandidateStatusChangeRequest(
    [MaxLength(120)] string? Reason,
    [MaxLength(400)] string? Note,
    [MaxLength(60)] string? Source
);

public sealed record CandidateStatusHistoryItemResponse(
    Guid Id,
    CandidateStatus FromStatus,
    CandidateStatus ToStatus,
    string? Reason,
    string? Note,
    string? Source,
    string? UserId,
    string? UserName,
    DateTimeOffset CreatedAtUtc
);
public sealed record CandidateListQuery(
    string? Q,
    CandidateStatus? Status,
    Guid? VagaId,
    CandidateOrigin? Fonte
);
