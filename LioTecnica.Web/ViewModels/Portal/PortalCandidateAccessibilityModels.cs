namespace LioTecnica.Web.ViewModels.Portal;

public sealed record PortalCandidateAccessibilityDto(
    string? Idioma,
    string? Canal,
    string? MelhorHorario,
    string? ObservacoesComunicacao,
    bool PrecisaLegendas,
    bool PrecisaInterprete,
    bool PrecisaLeitorTela,
    bool PrecisaBaixaEstimulo,
    bool PrecisaMobilidade,
    bool PrecisaTempoExtra,
    string? DetalhesNecessidades,
    bool ConsentimentoPcd,
    string? PcdIdentificacao,
    string? PcdTipo,
    string? PcdComprovacao,
    string? PcdObservacoes,
    DateTimeOffset UpdatedAtUtc
);

public sealed record PortalCandidateAccessibilityRequest(
    string? Idioma,
    string? Canal,
    string? MelhorHorario,
    string? ObservacoesComunicacao,
    bool PrecisaLegendas,
    bool PrecisaInterprete,
    bool PrecisaLeitorTela,
    bool PrecisaBaixaEstimulo,
    bool PrecisaMobilidade,
    bool PrecisaTempoExtra,
    string? DetalhesNecessidades,
    bool ConsentimentoPcd,
    string? PcdIdentificacao,
    string? PcdTipo,
    string? PcdComprovacao,
    string? PcdObservacoes
);
