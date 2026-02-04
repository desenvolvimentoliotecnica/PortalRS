using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

public sealed class FeedbackService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public FeedbackService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<FeedbackItemResponse> CreateAsync(FeedbackCreateRequest request, Guid fromUserId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var item = new FeedbackItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FromUserId = fromUserId,
            ToUserId = request.ToUserId,
            Content = request.Content.Trim(),
            Tipo = request.Tipo?.Trim().Length > 0 ? request.Tipo.Trim() : null,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.FeedbackItems.Add(item);
        await _db.SaveChangesAsync(ct);

        var created = await _db.FeedbackItems
            .AsNoTracking()
            .Include(x => x.FromUser)
            .Include(x => x.ToUser)
            .FirstOrDefaultAsync(x => x.Id == item.Id, ct);
        if (created is null)
            throw new InvalidOperationException("Feedback not found after create.");
        return MapToResponse(created);
    }

    public async Task<FeedbackListResponse> ListMineAsync(Guid userId, string filter = "all", int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var baseQuery = _db.FeedbackItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.FromUserId == userId || x.ToUserId == userId));

        if (string.Equals(filter, "received", StringComparison.OrdinalIgnoreCase))
            baseQuery = baseQuery.Where(x => x.ToUserId == userId);
        else if (string.Equals(filter, "sent", StringComparison.OrdinalIgnoreCase))
            baseQuery = baseQuery.Where(x => x.FromUserId == userId);

        var query = baseQuery
            .Include(x => x.FromUser)
            .Include(x => x.ToUser)
            .OrderByDescending(x => x.CreatedAtUtc);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new FeedbackItemResponse(
                x.Id,
                x.FromUserId,
                x.FromUser!.FullName ?? "",
                x.ToUserId,
                x.ToUser!.FullName ?? "",
                x.Content,
                x.Tipo,
                x.CreatedAtUtc))
            .ToListAsync(ct);

        return new FeedbackListResponse(items, total, page, pageSize);
    }

    public async Task<FeedbackListResponse> ListAllAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.FeedbackItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Include(x => x.FromUser)
            .Include(x => x.ToUser)
            .OrderByDescending(x => x.CreatedAtUtc);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new FeedbackItemResponse(
                x.Id,
                x.FromUserId,
                x.FromUser!.FullName ?? "",
                x.ToUserId,
                x.ToUser!.FullName ?? "",
                x.Content,
                x.Tipo,
                x.CreatedAtUtc))
            .ToListAsync(ct);

        return new FeedbackListResponse(items, total, page, pageSize);
    }

    private static FeedbackItemResponse MapToResponse(FeedbackItem x)
    {
        return new FeedbackItemResponse(
            x.Id,
            x.FromUserId,
            x.FromUser?.FullName ?? "",
            x.ToUserId,
            x.ToUser?.FullName ?? "",
            x.Content,
            x.Tipo,
            x.CreatedAtUtc);
    }
}
