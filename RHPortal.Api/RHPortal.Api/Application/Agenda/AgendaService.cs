using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Agenda;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.Agenda;

public sealed class AgendaService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public AgendaService(AppDbContext db, IStringLocalizer<ServiceMessages> localizer)
    {
        _db = db;
        _localizer = localizer;
    }

    public async Task<IReadOnlyList<AgendaEventTypeResponse>> ListTypesAsync(CancellationToken ct)
    {
        return await _db.AgendaEventTypes
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Label)
            .Select(x => new AgendaEventTypeResponse(
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

    public async Task<IReadOnlyList<AgendaEventResponse>> ListEventsAsync(AgendaEventsQuery query, CancellationToken ct)
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
            .Select(x => new AgendaEventResponse(
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
                x.Type != null ? x.Type.Code : string.Empty,
                x.Type != null ? x.Type.Label : string.Empty,
                x.Type != null ? x.Type.Color : "#6c757d",
                x.Type != null ? x.Type.Icon : "bi-calendar"
            ))
            .ToListAsync(ct);
    }

    public async Task<AgendaEventResponse?> GetEventByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.AgendaEvents
            .AsNoTracking()
            .Include(x => x.Type)
            .Where(x => x.Id == id)
            .Select(x => new AgendaEventResponse(
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
                x.Type != null ? x.Type.Code : string.Empty,
                x.Type != null ? x.Type.Label : string.Empty,
                x.Type != null ? x.Type.Color : "#6c757d",
                x.Type != null ? x.Type.Icon : "bi-calendar"
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<AgendaEventResponse> CreateAsync(AgendaEventCreateRequest request, CancellationToken ct)
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

    public async Task<AgendaEventResponse?> UpdateAsync(Guid id, AgendaEventUpdateRequest request, CancellationToken ct)
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
}
