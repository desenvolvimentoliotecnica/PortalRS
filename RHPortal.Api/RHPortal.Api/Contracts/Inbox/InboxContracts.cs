using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Inbox;

public sealed record InboxProcessamentoDto(
    int Pct,
    string? Etapa,
    IReadOnlyList<string> Log,
    int Tentativas,
    string? UltimoErro
);

public sealed record InboxAnexoDto(
    Guid? Id,
    [Required, MaxLength(200)] string Nome,
    [MaxLength(20)] string? Tipo,
    int TamanhoKB,
    [MaxLength(120)] string? Hash
);

public sealed record InboxSuggestedVagaDto(
    Guid VagaId,
    string? Titulo,
    int Score
);

public sealed record InboxCreateRequest(
    [Required] string Origem,
    [Required] string Status,
    DateTimeOffset RecebidoEm,
    [MaxLength(180)] string? Remetente,
    [MaxLength(220)] string? Assunto,
    [MaxLength(200)] string? Destinatario,
    Guid? VagaId,
    string? PreviewText,
    InboxProcessamentoDto? Processamento,
    IReadOnlyList<InboxAnexoDto>? Anexos,
    IReadOnlyList<InboxSuggestedVagaDto>? SuggestedVagas
);

public sealed record InboxUpdateRequest(
    [Required] string Origem,
    [Required] string Status,
    DateTimeOffset RecebidoEm,
    [MaxLength(180)] string? Remetente,
    [MaxLength(220)] string? Assunto,
    [MaxLength(200)] string? Destinatario,
    Guid? VagaId,
    string? PreviewText,
    InboxProcessamentoDto? Processamento,
    IReadOnlyList<InboxAnexoDto>? Anexos,
    IReadOnlyList<InboxSuggestedVagaDto>? SuggestedVagas
);

public sealed record InboxResponse(
    Guid Id,
    string Origem,
    string Status,
    DateTimeOffset RecebidoEm,
    string? Remetente,
    string? Assunto,
    string? Destinatario,
    Guid? VagaId,
    string? PreviewText,
    InboxProcessamentoDto? Processamento,
    IReadOnlyList<InboxAnexoDto> Anexos,
    IReadOnlyList<InboxSuggestedVagaDto> SuggestedVagas,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
