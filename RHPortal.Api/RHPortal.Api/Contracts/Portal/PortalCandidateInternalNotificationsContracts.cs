using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateInternalNotificationDto(
    Guid Id,
    Guid CandidatoId,
    Guid? VagaId,
    string? VagaTitulo,
    Guid? CandidaturaId,
    string Tipo,
    string Titulo,
    string Mensagem,
    IReadOnlyList<string> CamposPendentes,
    DateTimeOffset? LidaEmUtc,
    DateTimeOffset? ResolvidaEmUtc,
    string? CriadaPorNome,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record PortalCandidateInternalNotificationsResponse(
    IReadOnlyList<PortalCandidateInternalNotificationDto> Items,
    int NaoLidas,
    int Pendentes);

public sealed record SolicitarAtualizacaoDadosCandidatoRequest(
    Guid? VagaId,
    Guid? CandidaturaId,
    [Required, MinLength(1)] IReadOnlyList<string> CamposPendentes,
    [MaxLength(160)] string? Titulo,
    [MaxLength(2000)] string? Mensagem);
