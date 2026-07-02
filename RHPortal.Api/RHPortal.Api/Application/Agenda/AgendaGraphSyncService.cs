using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.MicrosoftGraph;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Agenda;

public interface IAgendaGraphSyncService
{
    Task TrySyncCreateAsync(Guid agendaEventId, CancellationToken ct);
    Task TrySyncUpdateAsync(Guid agendaEventId, CancellationToken ct);
    Task TrySyncDeleteAsync(string? graphEventId, string? graphUserUpn, CancellationToken ct);
}

public sealed class AgendaGraphSyncService : IAgendaGraphSyncService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _currentUser;
    private readonly IMicrosoftGraphCalendarService _graph;
    private readonly ILogger<AgendaGraphSyncService> _logger;

    public AgendaGraphSyncService(
        AppDbContext db,
        ICurrentUserContext currentUser,
        IMicrosoftGraphCalendarService graph,
        ILogger<AgendaGraphSyncService> logger)
    {
        _db = db;
        _currentUser = currentUser;
        _graph = graph;
        _logger = logger;
    }

    public async Task TrySyncCreateAsync(Guid agendaEventId, CancellationToken ct)
    {
        var entity = await _db.AgendaEvents.FirstOrDefaultAsync(x => x.Id == agendaEventId, ct);
        if (entity is null || !string.IsNullOrWhiteSpace(entity.GraphCalendarEventId))
            return;

        await SyncAsync(entity, isCreate: true, ct);
    }

    public async Task TrySyncUpdateAsync(Guid agendaEventId, CancellationToken ct)
    {
        var entity = await _db.AgendaEvents.FirstOrDefaultAsync(x => x.Id == agendaEventId, ct);
        if (entity is null)
            return;

        await SyncAsync(entity, isCreate: string.IsNullOrWhiteSpace(entity.GraphCalendarEventId), ct);
    }

    public async Task TrySyncDeleteAsync(string? graphEventId, string? graphUserUpn, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(graphEventId) || string.IsNullOrWhiteSpace(graphUserUpn))
            return;

        try
        {
            await _graph.DeleteCalendarEventAsync(graphUserUpn.Trim(), graphEventId.Trim(), ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao excluir evento {GraphEventId} do Outlook (UPN {Upn}).", graphEventId, graphUserUpn);
        }
    }

    private async Task SyncAsync(AgendaEvent entity, bool isCreate, CancellationToken ct)
    {
        var userUpn = await ResolveCalendarUserUpnAsync(entity.Owner, ct);
        if (string.IsNullOrWhiteSpace(userUpn))
        {
            _logger.LogInformation(
                "Evento {AgendaEventId} não sincronizado com Outlook: UPN do calendário não identificado.",
                entity.Id);
            return;
        }

        var request = BuildWriteRequest(entity, userUpn);

        try
        {
            if (isCreate)
            {
                var graphResult = await _graph.CreateCalendarEventAsync(request, ct);
                if (graphResult is null || string.IsNullOrWhiteSpace(graphResult.EventId))
                    return;

                entity.GraphCalendarEventId = graphResult.EventId;
                entity.GraphCalendarUserUpn = userUpn;
                if (!string.IsNullOrWhiteSpace(graphResult.OnlineMeetingJoinUrl))
                    entity.OnlineMeetingJoinUrl = graphResult.OnlineMeetingJoinUrl.Trim();
                entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
                return;
            }

            if (string.IsNullOrWhiteSpace(entity.GraphCalendarEventId))
                return;

            var targetUpn = string.IsNullOrWhiteSpace(entity.GraphCalendarUserUpn)
                ? userUpn
                : entity.GraphCalendarUserUpn.Trim();

            await _graph.UpdateCalendarEventAsync(targetUpn, entity.GraphCalendarEventId, request, ct);
            entity.GraphCalendarUserUpn = targetUpn;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Falha ao sincronizar evento {AgendaEventId} com Outlook (UPN {Upn}, create={IsCreate}).",
                entity.Id,
                userUpn,
                isCreate);
        }
    }

    private async Task<string?> ResolveCalendarUserUpnAsync(string? owner, CancellationToken ct)
    {
        var ownerTrim = owner?.Trim();
        if (!string.IsNullOrWhiteSpace(ownerTrim) && ownerTrim.Contains('@', StringComparison.Ordinal))
            return ownerTrim;

        if (!string.IsNullOrWhiteSpace(ownerTrim))
        {
            var email = await _db.Users.AsNoTracking()
                .Where(u => u.IsActive && u.Email != null && u.Email != "")
                .Where(u =>
                    u.FullName == ownerTrim
                    || u.UserName == ownerTrim
                    || EF.Functions.ILike(u.FullName, ownerTrim))
                .Select(u => u.Email)
                .FirstOrDefaultAsync(ct);

            if (!string.IsNullOrWhiteSpace(email))
                return email.Trim();
        }

        var currentEmail = _currentUser.Email?.Trim();
        return string.IsNullOrWhiteSpace(currentEmail) ? null : currentEmail;
    }

    private static GraphCalendarEventWriteRequest BuildWriteRequest(AgendaEvent entity, string userUpn) =>
        new()
        {
            UserUpn = userUpn,
            Subject = entity.Title,
            StartAtUtc = entity.StartAtUtc,
            EndAtUtc = entity.EndAtUtc,
            AllDay = entity.AllDay,
            Location = entity.Location,
            Body = BuildGraphBody(entity),
            IsOnlineMeeting = ShouldCreateOnlineMeeting(entity.Location, entity.Notes),
        };

    private static string BuildGraphBody(AgendaEvent entity)
    {
        var lines = new List<string>();
        if (!string.IsNullOrWhiteSpace(entity.Candidate))
            lines.Add($"Candidato: {entity.Candidate.Trim()}");
        if (!string.IsNullOrWhiteSpace(entity.VagaTitle))
        {
            var vaga = entity.VagaTitle.Trim();
            if (!string.IsNullOrWhiteSpace(entity.VagaCode))
                vaga = $"{entity.VagaCode.Trim()} — {vaga}";
            lines.Add($"Vaga: {vaga}");
        }
        if (!string.IsNullOrWhiteSpace(entity.Owner))
            lines.Add($"Responsável: {entity.Owner.Trim()}");
        if (!string.IsNullOrWhiteSpace(entity.Status))
            lines.Add($"Status: {entity.Status.Trim()}");
        if (!string.IsNullOrWhiteSpace(entity.Notes))
        {
            if (lines.Count > 0)
                lines.Add("");
            lines.Add(entity.Notes.Trim());
        }

        if (lines.Count > 0)
            lines.Add("");
        lines.Add("—");
        lines.Add("Sincronizado pelo Portal RH");

        return string.Join("\n", lines);
    }

    private static bool ShouldCreateOnlineMeeting(string? location, string? notes)
    {
        if (ContainsOnlineHint(location))
            return true;

        if (string.IsNullOrWhiteSpace(notes))
            return false;

        foreach (var line in notes.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (line.StartsWith("Formato:", StringComparison.OrdinalIgnoreCase)
                && line.Contains("online", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return ContainsOnlineHint(notes);
    }

    private static bool ContainsOnlineHint(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && (value.Contains("online", StringComparison.OrdinalIgnoreCase)
            || value.Contains("teams", StringComparison.OrdinalIgnoreCase));
}
