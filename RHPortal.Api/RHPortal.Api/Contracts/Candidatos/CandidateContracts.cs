using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Contracts.Talentos;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Candidates;

public sealed record CandidateCreateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [Required, MaxLength(40)] string Celular,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    [MaxLength(260)] string? LinkedinUrl,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    [Required] Guid VagaId,
    bool? TrabalhandoAtualmente,
    decimal? PretensaoSalarial,
    [MaxLength(2000)] string? Obs,
    string? CvText,
    CandidateMatchRequest? LastMatch,
    IReadOnlyList<CandidateDocumentoRequest>? Documentos,
    [MaxLength(120)] string? ApplicationRecruiterUserId,
    [MaxLength(200)] string? ApplicationRecruiterUserName,
    Guid? TalentoId = null
);

public sealed record CandidateUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [Required, MaxLength(40)] string Celular,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    [MaxLength(260)] string? LinkedinUrl,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    [Required] Guid VagaId,
    bool? TrabalhandoAtualmente,
    decimal? PretensaoSalarial,
    [MaxLength(2000)] string? Obs,
    string? CvText,
    CandidateMatchRequest? LastMatch,
    IReadOnlyList<CandidateDocumentoRequest>? Documentos,
    CandidateStatusChangeRequest? StatusChange,
    [MaxLength(120)] string? ApplicationRecruiterUserId,
    [MaxLength(200)] string? ApplicationRecruiterUserName,
    Guid? TalentoId = null
);

public sealed record CandidateListItemResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Celular,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    bool? TrabalhandoAtualmente,
    decimal? PretensaoSalarial,
    Guid? VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    string? Obs,
    string? CvText,
    CandidateMatchResponse? LastMatch,
    string? ApplicationRecruiterUserId,
    string? ApplicationRecruiterUserName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CandidateResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Celular,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    CandidateOrigin Fonte,
    CandidateStatus Status,
    bool? TrabalhandoAtualmente,
    decimal? PretensaoSalarial,
    Guid? VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    Guid? VagaAreaId,
    Guid? VagaRecrutadorResponsavelUserId,
    Guid? TalentoId,
    string? Obs,
    string? ResumoProfissional,
    string? CvText,
    CandidateMatchResponse? LastMatch,
    IReadOnlyList<CandidateDocumentoResponse> Documentos,
    string? ApplicationRecruiterUserId,
    string? ApplicationRecruiterUserName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

/// <summary>Resposta do upload de currículo com extração de texto e dados sugeridos pela LLM.</summary>
public sealed record CandidatoCurriculoExtrairResponse(
    CandidateDocumentoResponse Documento,
    string? CvText,
    TalentoImportPdfSuggestedData? SuggestedData
);

/// <summary>Parse de currículo sem criar candidato nem persistir documento (IA opcional + heurística).</summary>
public sealed record CandidatoCurriculoParseResponse(
    string? CvText,
    string? Nome,
    string? Email,
    string? Fone,
    string? Celular,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    decimal? PretensaoSalarial,
    /// <summary><c>ai</c> quando a LLM preencheu campos; <c>heuristic</c> só extrator determinístico.</summary>
    string Fonte = "heuristic"
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
    [MaxLength(400)] string? Url,
    Guid? VagaId = null
);

public sealed record CandidateDocumentoUploadRequest(
    [Required] string Tipo,
    [MaxLength(240)] string? Descricao,
    [Required] IFormFile Arquivo,
    Guid? VagaId = null
);

public sealed record CandidateCurriculoUploadRequest(
    [Required] IFormFile Arquivo,
    bool EnviarParaGpt = true
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
    DateTimeOffset UpdatedAtUtc,
    Guid? VagaId,
    bool TemArquivo
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
    IReadOnlyList<CandidateStatus>? Statuses,
    Guid? VagaId,
    IReadOnlyList<Guid>? VagaIds,
    CandidateOrigin? Fonte,
    Guid? AreaId,
    Guid? RecrutadorUserId,
    int Page = 1,
    int PageSize = 20
);

public sealed record CandidatePagedResponse(
    IReadOnlyList<CandidateListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize
);
