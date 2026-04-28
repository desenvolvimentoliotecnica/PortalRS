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

        // Defensivo: aceita lista null, vazia ou com nulls dentro (front pode enviar
        // [null] quando o matching de @menção não casa com nenhum user). Filtra antes.
        var mentionedIds = (request.MentionedUserIds ?? Array.Empty<Guid?>())
            .Where(x => x.HasValue && x.Value != Guid.Empty)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
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

    public async Task<CelebrationFeedResponse> ListFeedAsync(
        Guid currentUserId,
        string? filter,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var baseQuery = _db.CelebrationPosts
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId);

        if (from.HasValue)
            baseQuery = baseQuery.Where(x => x.CreatedAtUtc >= from.Value);
        if (to.HasValue)
            baseQuery = baseQuery.Where(x => x.CreatedAtUtc <= to.Value);

        var normalizedFilter = (filter ?? "all").Trim().ToLowerInvariant();
        if (normalizedFilter == "sent")
        {
            baseQuery = baseQuery.Where(x => x.AuthorId == currentUserId);
        }
        else if (normalizedFilter == "received")
        {
            baseQuery = baseQuery.Where(x => x.Mentions.Any(m => m.UserId == currentUserId));
        }

        var query = baseQuery
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

    public async Task<CelebrationCommentsListResponse> ListCommentsAsync(Guid currentUserId, Guid postId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.CelebrationComments
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.PostId == postId)
            .Include(x => x.Author)
            .Include(x => x.Mentions)
            .ThenInclude(m => m.User)
            .OrderBy(x => x.CreatedAtUtc);

        var total = await query.CountAsync(ct);
        var comments = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var commentIds = comments.Select(x => x.Id).ToList();
        var reactions = await _db.CelebrationCommentReactions
            .AsNoTracking()
            .Where(r => commentIds.Contains(r.CommentId))
            .Select(r => new { r.CommentId, r.UserId, r.Type })
            .ToListAsync(ct);

        var reactionCounts = reactions
            .GroupBy(x => new { x.CommentId, Type = (x.Type ?? "").Trim().ToLowerInvariant() })
            .ToDictionary(g => (g.Key.CommentId, g.Key.Type), g => g.Count());

        var reactedByMe = reactions
            .Where(x => x.UserId == currentUserId)
            .GroupBy(x => new { x.CommentId, Type = (x.Type ?? "").Trim().ToLowerInvariant() })
            .ToDictionary(g => (g.Key.CommentId, g.Key.Type), g => true);

        var items = comments.Select(c =>
        {
            var mentions = c.Mentions
                .Select(m => new CelebrationCommentMentionResponse(m.UserId, m.User?.FullName ?? ""))
                .ToList();

            var likeCount = reactionCounts.TryGetValue((c.Id, "like"), out var lc) ? lc : 0;
            var likeMine = reactedByMe.ContainsKey((c.Id, "like"));
            var reactionList = new List<CelebrationCommentReactionSummaryResponse>
            {
                new("like", likeCount, likeMine)
            };

            return new CelebrationCommentResponse(
                c.Id,
                c.PostId,
                c.AuthorId,
                c.Author?.FullName ?? "",
                c.Content,
                c.CreatedAtUtc,
                mentions,
                reactionList);
        }).ToList();

        return new CelebrationCommentsListResponse(items, total, page, pageSize);
    }

    public async Task<CelebrationCommentResponse?> CreateCommentAsync(Guid postId, CelebrationCommentCreateRequest request, Guid authorId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");

        var exists = await _db.CelebrationPosts
            .AsNoTracking()
            .AnyAsync(x => x.TenantId == tenantId && x.Id == postId, ct);
        if (!exists)
            return null;

        var comment = new CelebrationComment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PostId = postId,
            AuthorId = authorId,
            Content = request.Content.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.CelebrationComments.Add(comment);

        // Defensivo: aceita lista null, vazia ou com nulls dentro (front pode enviar
        // [null] quando o matching de @menção não casa com nenhum user). Filtra antes.
        var mentionedIds = (request.MentionedUserIds ?? Array.Empty<Guid?>())
            .Where(x => x.HasValue && x.Value != Guid.Empty)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        if (mentionedIds.Count > 0)
        {
            var validUserIds = await _db.Users
                .Where(u => u.TenantId == tenantId && mentionedIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync(ct);

            foreach (var userId in validUserIds)
            {
                _db.CelebrationCommentMentions.Add(new CelebrationCommentMention
                {
                    Id = Guid.NewGuid(),
                    CommentId = comment.Id,
                    UserId = userId
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        var created = await _db.CelebrationComments
            .AsNoTracking()
            .Include(x => x.Author)
            .Include(x => x.Mentions)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == comment.Id, ct);

        if (created is null)
            throw new InvalidOperationException("Comment not found after create.");

        var mentionList = created.Mentions
            .Select(m => new CelebrationCommentMentionResponse(m.UserId, m.User?.FullName ?? ""))
            .ToList();

        return new CelebrationCommentResponse(
            created.Id,
            created.PostId,
            created.AuthorId,
            created.Author?.FullName ?? "",
            created.Content,
            created.CreatedAtUtc,
            mentionList,
            new List<CelebrationCommentReactionSummaryResponse> { new("like", 0, false) });
    }

    public async Task<CelebrationCommentReactionSummaryResponse?> ToggleCommentReactionAsync(Guid commentId, Guid userId, string type, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var normalizedType = (type ?? "").Trim().ToLowerInvariant();
        if (normalizedType.Length == 0) normalizedType = "like";
        if (normalizedType.Length > 20) normalizedType = normalizedType[..20];

        var commentExists = await _db.CelebrationComments
            .AsNoTracking()
            .AnyAsync(x => x.TenantId == tenantId && x.Id == commentId, ct);
        if (!commentExists)
            return null;

        var existing = await _db.CelebrationCommentReactions
            .FirstOrDefaultAsync(x => x.CommentId == commentId && x.UserId == userId && x.Type.ToLower() == normalizedType, ct);

        var reactedByMeNow = false;
        if (existing is null)
        {
            _db.CelebrationCommentReactions.Add(new CelebrationCommentReaction
            {
                Id = Guid.NewGuid(),
                CommentId = commentId,
                UserId = userId,
                Type = normalizedType,
                CreatedAtUtc = DateTimeOffset.UtcNow
            });
            reactedByMeNow = true;
        }
        else
        {
            _db.CelebrationCommentReactions.Remove(existing);
            reactedByMeNow = false;
        }

        await _db.SaveChangesAsync(ct);

        var count = await _db.CelebrationCommentReactions
            .AsNoTracking()
            .CountAsync(x => x.CommentId == commentId && x.Type.ToLower() == normalizedType, ct);

        return new CelebrationCommentReactionSummaryResponse(normalizedType, count, reactedByMeNow);
    }
}
