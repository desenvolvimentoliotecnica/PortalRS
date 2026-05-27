using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Schedule;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.Agenda;

public sealed class AgendaService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;
    private readonly ITenantContext _tenantContext;
    private readonly NotificationPublisher _notifications;
    private readonly IEmailQueueService _emailQueue;

    public AgendaService(
        AppDbContext db,
        IStringLocalizer<ServiceMessages> localizer,
        ITenantContext tenantContext,
        NotificationPublisher notifications,
        IEmailQueueService emailQueue)
    {
        _db = db;
        _localizer = localizer;
        _tenantContext = tenantContext;
        _notifications = notifications;
        _emailQueue = emailQueue;
    }

    public async Task<IReadOnlyList<ScheduleEventTypeResponse>> ListTypesAsync(CancellationToken ct)
    {
        return await _db.AgendaEventTypes
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Label)
            .Select(x => new ScheduleEventTypeResponse(
                x.Id,
                x.Code,
                x.Label,
                x.Color,
                x.Icon,
                x.SortOrder,
                x.IsActive
            ))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ScheduleEventResponse>> ListEventsAsync(ScheduleEventsQuery query, CancellationToken ct)
    {
        var search = (query.Search ?? string.Empty).Trim();
        var type = (query.Type ?? string.Empty).Trim();
        var status = (query.Status ?? string.Empty).Trim();
        var startUtc = query.Start.HasValue ? NormalizeToUtc(query.Start.Value) : (DateTime?)null;
        var endUtc = query.End.HasValue ? NormalizeToUtc(query.End.Value) : (DateTime?)null;

        IQueryable<AgendaEvent> q = _db.AgendaEvents
            .AsNoTracking()
            .Include(x => x.Type);

        if (startUtc.HasValue)
            q = q.Where(x => x.StartAtUtc >= startUtc.Value);

        if (endUtc.HasValue)
            q = q.Where(x => x.StartAtUtc < endUtc.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            q = q.Where(x =>
                x.Title.Contains(search) ||
                (x.Candidate != null && x.Candidate.Contains(search)) ||
                (x.VagaTitle != null && x.VagaTitle.Contains(search)) ||
                (x.VagaCode != null && x.VagaCode.Contains(search)) ||
                (x.Owner != null && x.Owner.Contains(search)) ||
                (x.Location != null && x.Location.Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(type) && !string.Equals(type, "all", StringComparison.OrdinalIgnoreCase))
            q = q.Where(x => x.Type != null && x.Type.Code == type);

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
            q = q.Where(x => x.Status == status);

        return await q
            .OrderBy(x => x.StartAtUtc)
            .Select(x => new ScheduleEventResponse(
                x.Id,
                x.Title,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AllDay,
                x.Status,
                x.Location,
                x.Owner,
                x.Candidate,
                x.VagaTitle,
                x.VagaCode,
                x.Notes,
                x.CandidaturaId,
                x.CandidatoId,
                x.VagaId,
                x.CandidateResponseStatus,
                x.CandidateRespondedAtUtc,
                x.CandidateSuggestedStartAtUtc,
                x.CandidateSuggestedEndAtUtc,
                x.CandidateResponseMessage,
                x.CandidateConfirmationToken,
                x.Type != null ? x.Type.Code : string.Empty,
                x.Type != null ? x.Type.Label : string.Empty,
                x.Type != null ? x.Type.Color : "#6c757d",
                x.Type != null ? x.Type.Icon : "bi-calendar"
            ))
            .ToListAsync(ct);
    }

    public async Task<ScheduleEventResponse?> GetEventByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.AgendaEvents
            .AsNoTracking()
            .Include(x => x.Type)
            .Where(x => x.Id == id)
            .Select(x => new ScheduleEventResponse(
                x.Id,
                x.Title,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AllDay,
                x.Status,
                x.Location,
                x.Owner,
                x.Candidate,
                x.VagaTitle,
                x.VagaCode,
                x.Notes,
                x.CandidaturaId,
                x.CandidatoId,
                x.VagaId,
                x.CandidateResponseStatus,
                x.CandidateRespondedAtUtc,
                x.CandidateSuggestedStartAtUtc,
                x.CandidateSuggestedEndAtUtc,
                x.CandidateResponseMessage,
                x.CandidateConfirmationToken,
                x.Type != null ? x.Type.Code : string.Empty,
                x.Type != null ? x.Type.Label : string.Empty,
                x.Type != null ? x.Type.Color : "#6c757d",
                x.Type != null ? x.Type.Icon : "bi-calendar"
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<ScheduleEventResponse> CreateAsync(ScheduleEventCreateRequest request, CancellationToken ct)
    {
        var type = await GetTypeByCodeAsync(request.TypeCode, ct);

        var start = NormalizeToUtc(request.StartAtUtc);
        var end = NormalizeEnd(start, NormalizeToUtc(request.EndAtUtc));

        var entity = new AgendaEvent
        {
            Id = Guid.NewGuid(),
            TypeId = type.Id,
            Title = request.Title.Trim(),
            StartAtUtc = start,
            EndAtUtc = end,
            AllDay = request.AllDay,
            Status = request.Status.Trim(),
            Location = TrimOrNull(request.Location),
            Owner = TrimOrNull(request.Owner),
            Candidate = TrimOrNull(request.Candidate),
            VagaTitle = TrimOrNull(request.VagaTitle),
            VagaCode = TrimOrNull(request.VagaCode),
            Notes = TrimOrNull(request.Notes)
        };

        _db.AgendaEvents.Add(entity);
        await _db.SaveChangesAsync(ct);
        return (await GetEventByIdAsync(entity.Id, ct))!;
    }

    public async Task<ScheduleEventResponse?> UpdateAsync(Guid id, ScheduleEventUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.AgendaEvents.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        var type = await GetTypeByCodeAsync(request.TypeCode, ct);

        entity.TypeId = type.Id;
        entity.Title = request.Title.Trim();
        entity.StartAtUtc = NormalizeToUtc(request.StartAtUtc);
        entity.EndAtUtc = NormalizeEnd(entity.StartAtUtc, NormalizeToUtc(request.EndAtUtc));
        entity.AllDay = request.AllDay;
        entity.Status = request.Status.Trim();
        entity.Location = TrimOrNull(request.Location);
        entity.Owner = TrimOrNull(request.Owner);
        entity.Candidate = TrimOrNull(request.Candidate);
        entity.VagaTitle = TrimOrNull(request.VagaTitle);
        entity.VagaCode = TrimOrNull(request.VagaCode);
        entity.Notes = TrimOrNull(request.Notes);

        await _db.SaveChangesAsync(ct);
        return await GetEventByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.AgendaEvents.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        _db.AgendaEvents.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<PublicInterviewResponse?> GetPublicInterviewAsync(string token, CancellationToken ct)
    {
        var entity = await FindByTokenAsync(token, asTracking: false, ct);
        return entity is null ? null : MapPublic(entity);
    }

    public async Task<PublicInterviewResponse?> ConfirmPublicInterviewAsync(string token, CancellationToken ct)
    {
        var entity = await FindByTokenAsync(token, asTracking: true, ct);
        if (entity is null) return null;

        entity.CandidateResponseStatus = "confirmado";
        entity.CandidateRespondedAtUtc = DateTimeOffset.UtcNow;
        entity.CandidateSuggestedStartAtUtc = null;
        entity.CandidateSuggestedEndAtUtc = null;
        entity.CandidateResponseMessage = null;
        entity.Status = "confirmado_candidato";

        await _db.SaveChangesAsync(ct);
        await NotifyResponsibleAsync(
            entity,
            "Entrevista confirmada pelo candidato",
            $"{entity.Candidate ?? "Candidato"} confirmou presença na entrevista.",
            ct);

        return MapPublic(entity);
    }

    public async Task<PublicInterviewResponse?> SuggestPublicInterviewTimeAsync(string token, SuggestInterviewTimeRequest request, CancellationToken ct)
    {
        var entity = await FindByTokenAsync(token, asTracking: true, ct);
        if (entity is null) return null;

        var start = NormalizeToUtc(request.SuggestedStartAtUtc);
        var end = NormalizeEnd(start, NormalizeToUtc(request.SuggestedEndAtUtc));

        entity.CandidateResponseStatus = "sugeriu_novo_horario";
        entity.CandidateRespondedAtUtc = DateTimeOffset.UtcNow;
        entity.CandidateSuggestedStartAtUtc = start;
        entity.CandidateSuggestedEndAtUtc = end;
        entity.CandidateResponseMessage = TrimOrNull(request.Message);
        entity.Status = "reagendamento_sugerido";

        await _db.SaveChangesAsync(ct);
        await NotifyResponsibleAsync(
            entity,
            "Candidato sugeriu outro horário",
            $"{entity.Candidate ?? "Candidato"} sugeriu {start.ToLocalTime():dd/MM/yyyy HH:mm} para a entrevista.",
            ct);

        return MapPublic(entity);
    }

    private async Task<AgendaEventType> GetTypeByCodeAsync(string code, CancellationToken ct)
    {
        var normalized = (code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized))
            throw new InvalidOperationException(_localizer["ServiceErrors.AgendaTypeRequired"]);

        var type = await _db.AgendaEventTypes
            .FirstOrDefaultAsync(x => x.Code == normalized, ct);

        if (type is null)
            throw new InvalidOperationException(_localizer["ServiceErrors.AgendaTypeNotFound", normalized]);

        return type;
    }

    private static DateTime NormalizeEnd(DateTime start, DateTime end)
    {
        if (end <= start)
            return start.AddHours(1);
        return end;
    }

    private static DateTime NormalizeToUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc)
            return value;

        if (value.Kind == DateTimeKind.Unspecified)
            return DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();

        return value.ToUniversalTime();
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private async Task<AgendaEvent?> FindByTokenAsync(string token, bool asTracking, CancellationToken ct)
    {
        var normalized = (token ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return null;

        var query = asTracking ? _db.AgendaEvents.AsQueryable() : _db.AgendaEvents.AsNoTracking();
        return await query.FirstOrDefaultAsync(x => x.CandidateConfirmationToken == normalized, ct);
    }

    private async Task NotifyResponsibleAsync(AgendaEvent entity, string title, string message, CancellationToken ct)
    {
        var userIds = new HashSet<Guid>();

        if (entity.VagaId is Guid vagaId)
        {
            var vagaUserId = await _db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == vagaId)
                .Select(v => v.RecrutadorResponsavelUserId)
                .FirstOrDefaultAsync(ct);
            if (vagaUserId is Guid vu) userIds.Add(vu);

            var analistaUserId = await _db.SolicitacoesVaga
                .AsNoTracking()
                .Where(s => s.VagaId == vagaId && s.AnalistaRhResponsavelUserId != null)
                .OrderByDescending(s => s.CreatedAtUtc)
                .Select(s => s.AnalistaRhResponsavelUserId)
                .FirstOrDefaultAsync(ct);
            if (analistaUserId is Guid au) userIds.Add(au);
        }

        if (userIds.Count == 0) return;

        var targetUserIds = userIds.ToList();
        await _notifications.PublishToUsersAsync(
            _tenantContext.TenantId,
            targetUserIds,
            title,
            message,
            "/app/agendas",
            "info",
            ct);

        await NotifyResponsibleByEmailAsync(entity, targetUserIds, title, message, ct);
    }

    private async Task NotifyResponsibleByEmailAsync(
        AgendaEvent entity,
        IReadOnlyCollection<Guid> userIds,
        string title,
        string message,
        CancellationToken ct)
    {
        if (userIds.Count == 0) return;

        var recipients = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id) && u.IsActive && u.Email != null && u.Email != "")
            .Select(u => new { u.Email, u.FullName })
            .ToListAsync(ct);

        if (recipients.Count == 0) return;

        var candidate = Html(entity.Candidate ?? "Candidato");
        var vaga = Html(entity.VagaTitle ?? "vaga não informada");
        var currentWhen = $"{entity.StartAtUtc.ToLocalTime():dd/MM/yyyy HH:mm} - {entity.EndAtUtc.ToLocalTime():HH:mm}";
        var suggestedWhen = entity.CandidateSuggestedStartAtUtc.HasValue
            ? $"{entity.CandidateSuggestedStartAtUtc.Value.ToLocalTime():dd/MM/yyyy HH:mm} - {entity.CandidateSuggestedEndAtUtc?.ToLocalTime():HH:mm}"
            : null;
        var responseMessage = string.IsNullOrWhiteSpace(entity.CandidateResponseMessage)
            ? ""
            : $"<p><strong>Mensagem do candidato:</strong><br />{Html(entity.CandidateResponseMessage).Replace("\n", "<br />")}</p>";
        var suggestedHtml = string.IsNullOrWhiteSpace(suggestedWhen)
            ? ""
            : $"<p><strong>Novo horário sugerido:</strong> {Html(suggestedWhen)}</p>";

        var bodyHtml = $"""
            <p>Olá,</p>
            <p>{Html(message)}</p>
            <p><strong>Candidato:</strong> {candidate}</p>
            <p><strong>Vaga:</strong> {vaga}</p>
            <p><strong>Horário agendado:</strong> {Html(currentWhen)}</p>
            <p><strong>Local/modalidade:</strong> {Html(entity.Location ?? "A combinar")}</p>
            {suggestedHtml}
            {responseMessage}
            <p>Acesse a agenda do portal para confirmar o agendamento ou enviar um novo horário.</p>
            """;

        foreach (var recipient in recipients)
        {
            await _emailQueue.EnqueueRawAsync(
                recipient.Email!,
                title,
                bodyHtml,
                null,
                isSystem: true,
                source: "agenda-entrevista-candidato",
                ct);
        }
    }

    private static string Html(string value)
        => System.Net.WebUtility.HtmlEncode(value);

    private static PublicInterviewResponse MapPublic(AgendaEvent entity) => new(
        entity.Id,
        entity.Title,
        entity.StartAtUtc,
        entity.EndAtUtc,
        entity.Status,
        entity.Location,
        entity.Owner,
        entity.Candidate,
        entity.VagaTitle,
        entity.VagaCode,
        entity.CandidateResponseStatus,
        entity.CandidateRespondedAtUtc,
        entity.CandidateSuggestedStartAtUtc,
        entity.CandidateSuggestedEndAtUtc,
        entity.CandidateResponseMessage);
}
