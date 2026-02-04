using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

public sealed class CelebrationService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public CelebrationService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<CelebrationPostResponse> CreateAsync(CelebrationCreateRequest request, Guid authorId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var post = new CelebrationPost
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AuthorId = authorId,
            Content = request.Content.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.CelebrationPosts.Add(post);

        var mentionedIds = (request.MentionedUserIds ?? Array.Empty<Guid>()).Distinct().ToList();
        if (mentionedIds.Count > 0)
        {
            var validUserIds = await _db.Users
                .Where(u => u.TenantId == tenantId && mentionedIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync(ct);
            foreach (var userId in validUserIds)
            {
                _db.CelebrationMentions.Add(new CelebrationMention
                {
                    Id = Guid.NewGuid(),
                    PostId = post.Id,
                    UserId = userId
                });
            }
        }

        await _db.SaveChangesAsync(ct);
        var created = await _db.CelebrationPosts
            .AsNoTracking()
            .Include(x => x.Author)
            .Include(x => x.Mentions)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(x => x.Id == post.Id, ct);
        if (created is null)
            throw new InvalidOperationException("Post not found after create.");
        var mentionList = created.Mentions.Select(m => new CelebrationMentionResponse(m.UserId, m.User?.FullName ?? "")).ToList();
        return new CelebrationPostResponse(created.Id, created.AuthorId, created.Author?.FullName ?? "", created.Content, created.CreatedAtUtc, mentionList);
    }

    public async Task<CelebrationFeedResponse> ListFeedAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.CelebrationPosts
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Include(x => x.Author)
            .Include(x => x.Mentions)
            .ThenInclude(m => m.User)
            .OrderByDescending(x => x.CreatedAtUtc);

        var total = await query.CountAsync(ct);
        var posts = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = new List<CelebrationPostResponse>();
        foreach (var p in posts)
        {
            var mentions = p.Mentions
                .Select(m => new CelebrationMentionResponse(m.UserId, m.User?.FullName ?? ""))
                .ToList();
            items.Add(new CelebrationPostResponse(
                p.Id,
                p.AuthorId,
                p.Author?.FullName ?? "",
                p.Content,
                p.CreatedAtUtc,
                mentions));
        }

        return new CelebrationFeedResponse(items, total, page, pageSize);
    }

    public async Task<IReadOnlyList<CelebrationMentionUserResponse>> GetMentionUsersAsync(string? q, int take = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var search = (q ?? "").Trim().ToLowerInvariant();

        var query = _db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.IsActive);

        if (search.Length > 0)
        {
            query = query.Where(u =>
                (u.FullName != null && u.FullName.ToLower().Contains(search)) ||
                (u.Email != null && u.Email.ToLower().Contains(search)));
        }

        return await query
            .OrderBy(u => u.FullName)
            .Take(take)
            .Select(u => new CelebrationMentionUserResponse(u.Id, u.FullName ?? "", u.Email))
            .ToListAsync(ct);
    }
}
