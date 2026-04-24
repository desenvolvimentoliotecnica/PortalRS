using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.MotivosRequisicaoVaga;

public sealed record MotivoRequisicaoVagaCreateRequest(
    [Required, MaxLength(60)]  string Codigo,
    [Required, MaxLength(120)] string Nome,
    [MaxLength(500)]           string? Descricao,
    EfeitoHeadcount            EfeitoHeadcount,
    bool                       IsActive,
    int                        Ordem
);

public sealed record MotivoRequisicaoVagaUpdateRequest(
    [Required, MaxLength(60)]  string Codigo,
    [Required, MaxLength(120)] string Nome,
    [MaxLength(500)]           string? Descricao,
    EfeitoHeadcount            EfeitoHeadcount,
    bool                       IsActive,
    int                        Ordem
);

public sealed record MotivoRequisicaoVagaResponse(
    Guid                Id,
    string              Codigo,
    string              Nome,
    string?             Descricao,
    EfeitoHeadcount     EfeitoHeadcount,
    bool                IsActive,
    int                 Ordem,
    bool                IsSystem,
    DateTimeOffset      CreatedAtUtc,
    DateTimeOffset      UpdatedAtUtc
);

public sealed record MotivoRequisicaoVagaLookupItem(
    Guid                Id,
    string              Codigo,
    string              Nome,
    EfeitoHeadcount     EfeitoHeadcount
);
