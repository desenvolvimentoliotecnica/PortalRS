namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidatePreferencesResponse(
    string? CargoAlvo,
    string? Senioridade,
    string? InicioDisponivel,
    string? Resumo,
    string? AreasInteresse,
    string? ModeloTrabalho,
    string? Jornada,
    string? TipoContrato,
    string? Viagens,
    string? Mudanca,
    string? CidadePreferida,
    string? DistanciaMaxKm,
    string? ObsDeslocamento,
    string? PretensaoSalarial,
    string? PretensaoNegociavel,
    string? BeneficiosDesejados,
    string? NaoAbreMaoDe,
    DateTimeOffset? UpdatedAtUtc
);

public sealed record PortalCandidatePreferencesRequest(
    string? CargoAlvo,
    string? Senioridade,
    string? InicioDisponivel,
    string? Resumo,
    string? AreasInteresse,
    string? ModeloTrabalho,
    string? Jornada,
    string? TipoContrato,
    string? Viagens,
    string? Mudanca,
    string? CidadePreferida,
    string? DistanciaMaxKm,
    string? ObsDeslocamento,
    string? PretensaoSalarial,
    string? PretensaoNegociavel,
    string? BeneficiosDesejados,
    string? NaoAbreMaoDe
);
