using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

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

public sealed class EnviarMensagemCandidatoFormRequest
{
    public Guid? VagaId { get; set; }
    public Guid? CandidaturaId { get; set; }

    [Required, MaxLength(160)]
    public string Assunto { get; set; } = string.Empty;

    [Required, MaxLength(4000)]
    public string Corpo { get; set; } = string.Empty;

    public List<IFormFile> Anexos { get; set; } = new();
}
