using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalVagaCardResponse(
    Guid Id,
    string Titulo,
    string? Area,
    VagaModalidade? Modalidade,
    VagaTipoContratacao? TipoContratacao,
    VagaSenioridade? Senioridade,
    string? Cidade,
    string? Uf,
    string? TagsKeywordsRaw,
    string? TagsStackRaw,
    string? TagsResponsabilidadesRaw,
    DateTimeOffset CreatedAtUtc,
    string? TenantName,
    string? DescricaoPublica,
    bool Urgente,
    bool AceitaPcd,
    int? QuantidadeVagas,
    IReadOnlyList<string> Etapas
);
