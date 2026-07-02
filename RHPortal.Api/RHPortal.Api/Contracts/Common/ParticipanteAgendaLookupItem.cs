namespace RhPortal.Api.Contracts.Common;

public sealed record ParticipanteAgendaLookupItem(
    string Id,
    string Nome,
    string? Email,
    string Origem
);
