namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateAgendaPreferencesDto(
    string? FormatoEntrevista,
    string? InicioDisponivel,
    string? AvisoPrevio,
    string? Observacoes,
    bool DiaSeg,
    bool DiaTer,
    bool DiaQua,
    bool DiaQui,
    bool DiaSex,
    bool DiaSab,
    bool DiaDom,
    bool PeriodoManha,
    bool PeriodoTarde,
    bool PeriodoNoite,
    string? HorarioPreferido,
    string? FusoHorario,
    DateTimeOffset UpdatedAtUtc
);

public sealed record PortalCandidateAgendaBlockDto(
    Guid Id,
    string? Tipo,
    string? Titulo,
    string? Data,
    string? Horario,
    string? Observacoes,
    DateTimeOffset UpdatedAtUtc
);

public sealed record PortalCandidateAgendaResponse(
    PortalCandidateAgendaPreferencesDto Preferences,
    IReadOnlyList<PortalCandidateAgendaBlockDto> Blocks
);

public sealed record PortalCandidateAgendaPreferencesRequest(
    string? FormatoEntrevista,
    string? InicioDisponivel,
    string? AvisoPrevio,
    string? Observacoes,
    bool DiaSeg,
    bool DiaTer,
    bool DiaQua,
    bool DiaQui,
    bool DiaSex,
    bool DiaSab,
    bool DiaDom,
    bool PeriodoManha,
    bool PeriodoTarde,
    bool PeriodoNoite,
    string? HorarioPreferido,
    string? FusoHorario
);

public sealed record PortalCandidateAgendaBlockRequest(
    string? Tipo,
    string? Titulo,
    string? Data,
    string? Horario,
    string? Observacoes
);
