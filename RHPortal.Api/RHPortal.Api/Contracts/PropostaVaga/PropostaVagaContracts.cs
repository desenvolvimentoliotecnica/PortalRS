using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.PropostaVaga;

public sealed record PropostaVagaCreateRequest(
    [Required] Guid VagaId,
    [Required] Guid CandidatoId,
    [MaxLength(3)] string? Moeda,
    decimal? SalarioOferecido,
    [MaxLength(2000)] string? DescricaoBeneficios,
    DateOnly? DataPrevistaInicio,
    [MaxLength(8000)] string? MensagemPersonalizada,
    [MaxLength(500)] string? ObservacaoInternaRh);

public sealed record PropostaVagaUpdateRequest(
    [MaxLength(3)] string? Moeda,
    decimal? SalarioOferecido,
    [MaxLength(2000)] string? DescricaoBeneficios,
    DateOnly? DataPrevistaInicio,
    [MaxLength(8000)] string? MensagemPersonalizada,
    [MaxLength(500)] string? ObservacaoInternaRh);

public sealed record EnviarPropostaRequest(int? PrazoDiasResposta);

public sealed record AceitarPropostaRequest(
    [Required, MaxLength(160)] string NomeConfirmado);

public sealed record RecusarPropostaRequest(
    [Required, MaxLength(160)] string NomeConfirmado,
    [MaxLength(2000)] string? MotivoRecusa);

public sealed record PropostaVagaResponse(
    Guid Id,
    Guid VagaId,
    string? VagaTitulo,
    Guid CandidatoId,
    string? CandidatoNome,
    string? CandidatoEmail,
    Guid? CandidaturaId,
    PropostaVagaStatus Status,
    string? Moeda,
    decimal? SalarioOferecido,
    string? DescricaoBeneficios,
    DateOnly? DataPrevistaInicio,
    string? MensagemPersonalizada,
    string? AccessToken,
    DateTimeOffset? EnviadaEmUtc,
    DateTimeOffset? ExpiraEmUtc,
    DateTimeOffset? VisualizadaEmUtc,
    DateTimeOffset? RespondidaEmUtc,
    string? NomeConfirmadoCandidato,
    string? MotivoRecusa,
    string? ObservacaoInternaRh,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>Visão pública (sem dados internos) para o candidato que acessa via token.</summary>
public sealed record PropostaVagaPublicaResponse(
    Guid Id,
    string? VagaTitulo,
    string? CandidatoNome,
    PropostaVagaStatus Status,
    string? Moeda,
    decimal? SalarioOferecido,
    string? DescricaoBeneficios,
    DateOnly? DataPrevistaInicio,
    string? MensagemPersonalizada,
    DateTimeOffset? EnviadaEmUtc,
    DateTimeOffset? ExpiraEmUtc,
    DateTimeOffset? RespondidaEmUtc);
