namespace LioTecnica.Web.ViewModels.Agenda;

public sealed record AgendaEventTypeViewModel(
    Guid Id,
    string Code,
    string Label,
    string Color,
    string Icon,
    int SortOrder,
    bool IsActive
);

public sealed record AgendaEventViewModel(
    Guid Id,
    string Title,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    bool AllDay,
    string Status,
    string? Location,
    string? Owner,
    string? Candidate,
    string? VagaTitle,
    string? VagaCode,
    string? Notes,
    string TypeCode,
    string TypeLabel,
    string TypeColor,
    string TypeIcon
);

public sealed record AgendaEventRequest(
    string Title,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    bool AllDay,
    string Status,
    string? Location,
    string? Owner,
    string? Candidate,
    string? VagaTitle,
    string? VagaCode,
    string? Notes,
    string TypeCode
);
