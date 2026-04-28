using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

public sealed class OneOnOneService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IOneOnOneTemplateService _templateService;

    public OneOnOneService(
        AppDbContext db,
        ITenantContext tenantContext,
        IOneOnOneTemplateService templateService)
    {
        _db = db;
        _tenantContext = tenantContext;
        _templateService = templateService;
    }

    public async Task<OneOnOneMeetingResponse> CreateAsync(OneOnOneCreateRequest request, Guid managerId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");

        var subject = request.Subject?.Trim().Length > 0 ? request.Subject.Trim() : null;
        var notes = request.Notes?.Trim().Length > 0 ? request.Notes.Trim() : null;

        // Entrega 1.2 — Fase 1 Paridade Feedz:
        // Se template foi informado, e usuário não passou Subject/Notes próprios,
        // popula com a pauta do template (Notes em markdown).
        if (request.TemplateId is { } templateId)
        {
            var rendered = await _templateService.RenderForMeetingAsync(templateId, ct);
            if (rendered is var (tplSubject, tplNotes))
            {
                subject ??= tplSubject;
                notes ??= tplNotes;
            }
        }

        var meeting = new OneOnOneMeeting
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ManagerId = managerId,
            CollaboratorId = request.CollaboratorId,
            MeetingDate = request.MeetingDate,
            Subject = subject,
            Notes = notes,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.OneOnOneMeetings.Add(meeting);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(meeting.Id, ct) ?? throw new InvalidOperationException("Meeting not found after create.");
    }

    public async Task<OneOnOneMeetingResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var m = await _db.OneOnOneMeetings
            .AsNoTracking()
            .Include(x => x.Manager)
            .Include(x => x.Collaborator)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, ct);
        return m == null ? null : MapToResponse(m);
    }

    public async Task<OneOnOneListResponse> ListForUserAsync(Guid userId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.OneOnOneMeetings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.ManagerId == userId || x.CollaboratorId == userId))
            .Include(x => x.Manager)
            .Include(x => x.Collaborator)
            .OrderByDescending(x => x.MeetingDate);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new OneOnOneMeetingResponse(
                x.Id,
                x.ManagerId,
                x.Manager!.FullName ?? "",
                x.CollaboratorId,
                x.Collaborator!.FullName ?? "",
                x.MeetingDate,
                x.Subject,
                x.Notes,
                x.CreatedAtUtc))
            .ToListAsync(ct);

        return new OneOnOneListResponse(items, total, page, pageSize);
    }

    public async Task<OneOnOneMeetingResponse?> UpdateAsync(Guid id, OneOnOneUpdateRequest request, Guid userId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var m = await _db.OneOnOneMeetings.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.ManagerId == userId, ct);
        if (m == null) return null;
        m.MeetingDate = request.MeetingDate;
        m.Subject = request.Subject?.Trim().Length > 0 ? request.Subject.Trim() : null;
        m.Notes = request.Notes?.Trim().Length > 0 ? request.Notes.Trim() : null;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var m = await _db.OneOnOneMeetings.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.ManagerId == userId, ct);
        if (m == null) return false;
        _db.OneOnOneMeetings.Remove(m);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static OneOnOneMeetingResponse MapToResponse(OneOnOneMeeting x)
    {
        return new OneOnOneMeetingResponse(
            x.Id,
            x.ManagerId,
            x.Manager?.FullName ?? "",
            x.CollaboratorId,
            x.Collaborator?.FullName ?? "",
            x.MeetingDate,
            x.Subject,
            x.Notes,
            x.CreatedAtUtc);
    }
}
