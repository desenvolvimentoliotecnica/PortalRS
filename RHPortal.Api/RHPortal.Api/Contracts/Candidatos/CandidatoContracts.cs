using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Candidatos;

public sealed record CandidatoCreateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    CandidatoFonte Fonte,
    CandidatoStatus Status,
    [Required] Guid VagaId,
    [MaxLength(2000)] string? Obs,
    string? CvText,
    CandidatoMatchRequest? LastMatch,
    IReadOnlyList<CandidatoDocumentoRequest>? Documentos
);

public sealed record CandidatoUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    CandidatoFonte Fonte,
    CandidatoStatus Status,
    [Required] Guid VagaId,
    [MaxLength(2000)] string? Obs,
    string? CvText,
    CandidatoMatchRequest? LastMatch,
    IReadOnlyList<CandidatoDocumentoRequest>? Documentos,
    CandidatoStatusChangeRequest? StatusChange
);

public sealed record CandidatoListItemResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    CandidatoFonte Fonte,
    CandidatoStatus Status,
    Guid? VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    string? Obs,
    string? CvText,
    CandidatoMatchResponse? LastMatch,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CandidatoResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    CandidatoFonte Fonte,
    CandidatoStatus Status,
    Guid? VagaId,
    string? VagaCodigo,
    string? VagaTitulo,
    string? Obs,
    string? CvText,
    CandidatoMatchResponse? LastMatch,
    IReadOnlyList<CandidatoDocumentoResponse> Documentos,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CandidatoMatchRequest(
    int? Score,
    bool? Pass,
    DateTimeOffset? AtUtc,
    Guid? VagaId
);

public sealed record CandidatoMatchResponse(
    int? Score,
    bool? Pass,
    DateTimeOffset? AtUtc,
    Guid? VagaId
);

public sealed record CandidatoDocumentoRequest(
    CandidatoDocumentoTipo Tipo,
    [Required, MaxLength(200)] string NomeArquivo,
    [MaxLength(120)] string? ContentType,
    [MaxLength(240)] string? Descricao,
    long? TamanhoBytes,
    [MaxLength(400)] string? Url
);

public sealed record CandidatoDocumentoUploadRequest(
    [Required] string Tipo,
    [MaxLength(240)] string? Descricao,
    [Required] IFormFile Arquivo
);

public sealed record CandidatoDocumentoResponse(
    Guid Id,
    CandidatoDocumentoTipo Tipo,
    string NomeArquivo,
    string? ContentType,
    string? Descricao,
    long? TamanhoBytes,
    string? Url,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CandidatoStatusChangeRequest(
    [MaxLength(120)] string? Reason,
    [MaxLength(400)] string? Note,
    [MaxLength(60)] string? Source
);

public sealed record CandidatoStatusHistoryItemResponse(
    Guid Id,
    CandidatoStatus FromStatus,
    CandidatoStatus ToStatus,
    string? Reason,
    string? Note,
    string? Source,
    string? UserId,
    string? UserName,
    DateTimeOffset CreatedAtUtc
);
