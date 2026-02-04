using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.BloqueioPessoa;

public sealed record BloqueioPessoaListQuery(
    string? Q,
    int Page = 1,
    int PageSize = 20
);

public sealed record BloqueioPessoaListItemResponse(
    Guid Id,
    Guid PessoaId,
    string Nome,
    string Email,
    string? Motivo,
    OrigemBloqueio OrigemBloqueio,
    DateTimeOffset CreatedAtUtc
);

public sealed record BloqueioPessoaPagedResponse(
    IReadOnlyList<BloqueioPessoaListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize
);

/// <summary>Request para bloquear uma pessoa já cadastrada (por PessoaId).</summary>
public sealed record BloqueioPessoaBlockByPessoaRequest([MaxLength(500)] string? Motivo);

public sealed record BloqueioPessoaCreateManualRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(500)] string? Motivo
);

public sealed record BloqueioPessoaResponse(
    Guid Id,
    Guid PessoaId,
    string Nome,
    string Email,
    string? Motivo,
    OrigemBloqueio OrigemBloqueio,
    DateTimeOffset CreatedAtUtc
);
