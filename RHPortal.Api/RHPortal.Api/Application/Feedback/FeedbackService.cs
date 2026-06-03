using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
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
        var toUserId = await EnsureRecipientUserAsync(request.ToUserId, tenantId, ct);
        var item = new FeedbackItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FromUserId = fromUserId,
            ToUserId = toUserId,
            Content = request.Content.Trim(),
            Tipo = request.Tipo?.Trim().Length > 0 ? request.Tipo.Trim() : null,
            IsPresencial = request.IsPresencial,
            InternalNotes = string.IsNullOrWhiteSpace(request.InternalNotes) ? null : request.InternalNotes.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        if (request.Ratings is { Count: > 0 })
        {
            foreach (var r in request.Ratings)
            {
                item.Ratings.Add(new FeedbackItemRating
                {
                    Id = Guid.NewGuid(),
                    FeedbackItemId = item.Id,
                    ItemName = r.ItemName.Trim(),
                    Stars = Math.Clamp(r.Stars, 1, 5)
                });
            }
        }

        _db.FeedbackItems.Add(item);
        await _db.SaveChangesAsync(ct);

        var created = await _db.FeedbackItems
            .AsNoTracking()
            .Include(x => x.FromUser)
            .Include(x => x.ToUser)
            .Include(x => x.Ratings)
            .FirstOrDefaultAsync(x => x.Id == item.Id, ct);
        if (created is null)
            throw new InvalidOperationException("Feedback not found after create.");
        return MapToResponse(created);
    }

    private async Task<Guid> EnsureRecipientUserAsync(Guid requestedId, string tenantId, CancellationToken ct)
    {
        var userExists = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == tenantId && x.Id == requestedId && x.IsActive, ct);

        if (userExists)
            return requestedId;

        var funcionario = await _db.Funcionarios
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId
                && x.Status == FuncionarioStatus.Active
                && (x.Id == requestedId || x.UserId == requestedId), ct);

        if (funcionario is null)
            throw new InvalidOperationException("Destinatário do feedback não encontrado ou inativo.");

        var targetUserId = funcionario.UserId ?? funcionario.Id;
        var targetUserExists = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == tenantId && x.Id == targetUserId, ct);

        if (targetUserExists)
            return targetUserId;

        var name = string.IsNullOrWhiteSpace(funcionario.Name)
            ? $"Funcionário {funcionario.Id:N}"
            : funcionario.Name.Trim();
        var email = string.IsNullOrWhiteSpace(funcionario.Email)
            ? $"f-{funcionario.Id:N}@shadow.local"
            : funcionario.Email.Trim();
        var now = DateTimeOffset.UtcNow;

        _db.Users.Add(new ApplicationUser
        {
            Id = targetUserId,
            TenantId = tenantId,
            FullName = name,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            IsActive = true,
            FuncionarioId = funcionario.Id,
            EmailConfirmed = false,
            LockoutEnabled = true,
            AccessFailedCount = 0,
            TwoFactorEnabled = false,
            PhoneNumberConfirmed = false,
            ConcurrencyStamp = Guid.NewGuid().ToString(),
            SecurityStamp = Guid.NewGuid().ToString(),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        funcionario.UserId = targetUserId;

        return targetUserId;
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
            .Include(x => x.Ratings)
            .OrderByDescending(x => x.CreatedAtUtc);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new FeedbackListResponse(items.Select(MapToResponse).ToList(), total, page, pageSize);
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
            .Include(x => x.Ratings)
            .OrderByDescending(x => x.CreatedAtUtc);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new FeedbackListResponse(items.Select(MapToResponse).ToList(), total, page, pageSize);
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
            x.IsPresencial,
            x.InternalNotes,
            x.Ratings.Select(r => new FeedbackRatingResponse(r.ItemName, r.Stars)).ToList(),
            x.CreatedAtUtc);
    }
}
