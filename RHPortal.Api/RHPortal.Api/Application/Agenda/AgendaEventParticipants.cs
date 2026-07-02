using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Funcionarios;
using RhPortal.Api.Application.MicrosoftGraph;
using RhPortal.Api.Contracts.Schedule;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Agenda;

internal static class AgendaEventParticipants
{
    private const int MaxParticipants = 20;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static IReadOnlyList<ScheduleEventParticipantDto> Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return Array.Empty<ScheduleEventParticipantDto>();

        try
        {
            var items = JsonSerializer.Deserialize<List<ScheduleEventParticipantDto>>(json, JsonOptions);
            return items?
                       .Where(x => x.FuncionarioId != Guid.Empty && !string.IsNullOrWhiteSpace(x.Email))
                       .ToList()
                   ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static string? Serialize(IReadOnlyList<ScheduleEventParticipantDto> participants)
    {
        if (participants.Count == 0)
            return null;

        return JsonSerializer.Serialize(participants, JsonOptions);
    }

    public static async Task<IReadOnlyList<ScheduleEventParticipantDto>> NormalizeAndValidateAsync(
        AppDbContext db,
        IFuncionarioCorporateEmailResolver emailResolver,
        IReadOnlyList<ScheduleEventParticipantDto>? participants,
        CancellationToken ct)
    {
        if (participants is null || participants.Count == 0)
            return Array.Empty<ScheduleEventParticipantDto>();

        if (participants.Count > MaxParticipants)
            throw new InvalidOperationException($"Máximo de {MaxParticipants} participantes por evento.");

        var ids = participants
            .Select(x => x.FuncionarioId)
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
            return Array.Empty<ScheduleEventParticipantDto>();

        var funcionarios = await db.Funcionarios.AsNoTracking()
            .Where(x => ids.Contains(x.Id) && x.Status == FuncionarioStatus.Active)
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);

        var byId = funcionarios.ToDictionary(x => x.Id);
        var resolvedEmails = await emailResolver.ResolveEmailsAsync(ids, ct);

        var normalized = new List<ScheduleEventParticipantDto>();
        var seenEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in participants)
        {
            if (item.FuncionarioId == Guid.Empty)
                continue;

            if (!byId.TryGetValue(item.FuncionarioId, out var funcionario))
                throw new InvalidOperationException("Participante inválido ou inativo.");

            if (!resolvedEmails.TryGetValue(funcionario.Id, out var email) || string.IsNullOrWhiteSpace(email))
                throw new InvalidOperationException(
                    $"Não foi possível obter e-mail corporativo para {funcionario.Name.Trim()} (chapa no AD).");

            email = email.Trim();
            if (!seenEmails.Add(email))
                continue;

            normalized.Add(new ScheduleEventParticipantDto(
                funcionario.Id,
                funcionario.Name.Trim(),
                email));

            if (normalized.Count >= MaxParticipants)
                break;
        }

        return normalized;
    }

    public static IReadOnlyList<GraphEventAttendee> ToGraphAttendees(IReadOnlyList<ScheduleEventParticipantDto> participants) =>
        participants
            .Select(x => new GraphEventAttendee
            {
                Email = x.Email.Trim(),
                Name = x.Nome.Trim(),
                Type = "required",
            })
            .ToList();
}
