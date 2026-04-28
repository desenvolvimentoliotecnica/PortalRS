using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

public sealed class DevelopmentPlanService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public DevelopmentPlanService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<DevelopmentPlanResponse> CreateAsync(DevelopmentPlanCreateRequest request, Guid ownerUserId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var plan = new DevelopmentPlan
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OwnerUserId = ownerUserId,
            TargetUserId = request.TargetUserId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim().Length > 0 ? request.Description.Trim() : null,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.DevelopmentPlans.Add(plan);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(plan.Id, ct) ?? throw new InvalidOperationException("Plan not found after create.");
    }

    /// <summary>
    /// Cria um plano + goals a partir de sugestão IA/heurística (Entrega 1.4 — Fase 1).
    /// O gestor já revisou o conteúdo no front antes de chamar.
    /// </summary>
    public async Task<DevelopmentPlanResponse> CreateFromSuggestionAsync(
        PdiCreateFromSuggestionRequest request,
        Guid ownerUserId,
        CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new InvalidOperationException("Título é obrigatório.");
        if (request.Goals is null || request.Goals.Count == 0)
            throw new InvalidOperationException("Pelo menos uma meta é obrigatória.");

        var planId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var plan = new DevelopmentPlan
        {
            Id = planId,
            TenantId = tenantId,
            OwnerUserId = ownerUserId,
            TargetUserId = request.TargetUserId,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Goals = request.Goals
                .Where(g => !string.IsNullOrWhiteSpace(g.Description))
                .Select((g, i) => new DevelopmentPlanGoal
                {
                    Id = Guid.NewGuid(),
                    PlanId = planId,
                    Description = g.Description.Trim(),
                    DueDate = g.DueDate,
                    Order = g.Order > 0 ? g.Order : i + 1,
                }).ToList(),
        };

        _db.DevelopmentPlans.Add(plan);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(plan.Id, ct) ?? throw new InvalidOperationException("Plan not found after create.");
    }

    public async Task<DevelopmentPlanResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var plan = await _db.DevelopmentPlans
            .AsNoTracking()
            .Include(x => x.OwnerUser)
            .Include(x => x.TargetUser)
            .Include(x => x.Goals.OrderBy(g => g.Order).ThenBy(g => g.DueDate))
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, ct);
        return plan == null ? null : MapToResponse(plan);
    }

    public async Task<DevelopmentPlanListResponse> ListMyAsync(Guid userId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.DevelopmentPlans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.OwnerUserId == userId || x.TargetUserId == userId))
            .Include(x => x.OwnerUser)
            .Include(x => x.TargetUser)
            .Include(x => x.Goals.OrderBy(g => g.Order))
            .OrderByDescending(x => x.UpdatedAtUtc);

        var total = await query.CountAsync(ct);
        var plans = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = plans.Select(MapToResponse).ToList();
        return new DevelopmentPlanListResponse(items, total, page, pageSize);
    }

    public async Task<DevelopmentPlanListResponse> ListForTeamAsync(Guid ownerUserId, Guid? targetUserId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.DevelopmentPlans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.OwnerUserId == ownerUserId);
        if (targetUserId.HasValue)
            query = query.Where(x => x.TargetUserId == targetUserId);
        query = query
            .Include(x => x.OwnerUser)
            .Include(x => x.TargetUser)
            .Include(x => x.Goals.OrderBy(g => g.Order))
            .OrderByDescending(x => x.UpdatedAtUtc);

        var total = await query.CountAsync(ct);
        var plans = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = plans.Select(MapToResponse).ToList();
        return new DevelopmentPlanListResponse(items, total, page, pageSize);
    }

    public async Task<DevelopmentPlanResponse?> UpdateAsync(Guid id, DevelopmentPlanUpdateRequest request, Guid userId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var plan = await _db.DevelopmentPlans.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.OwnerUserId == userId, ct);
        if (plan == null) return null;
        plan.Title = request.Title.Trim();
        plan.Description = request.Description?.Trim().Length > 0 ? request.Description.Trim() : null;
        plan.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var plan = await _db.DevelopmentPlans.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.OwnerUserId == userId, ct);
        if (plan == null) return false;
        _db.DevelopmentPlans.Remove(plan);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<DevelopmentPlanGoalResponse?> AddGoalAsync(Guid planId, DevelopmentPlanGoalCreateRequest request, Guid userId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var plan = await _db.DevelopmentPlans.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == planId && x.OwnerUserId == userId, ct);
        if (plan == null) return null;
        var goal = new DevelopmentPlanGoal
        {
            Id = Guid.NewGuid(),
            PlanId = planId,
            Description = request.Description.Trim(),
            DueDate = request.DueDate,
            Order = request.Order
        };
        _db.DevelopmentPlanGoals.Add(goal);
        await _db.SaveChangesAsync(ct);
        return new DevelopmentPlanGoalResponse(goal.Id, goal.Description, goal.DueDate, goal.ConcludedAt, goal.Order);
    }

    public async Task<DevelopmentPlanGoalResponse?> UpdateGoalAsync(Guid planId, Guid goalId, DevelopmentPlanGoalUpdateRequest request, Guid userId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var plan = await _db.DevelopmentPlans.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == planId && x.OwnerUserId == userId, ct);
        if (plan == null) return null;
        var goal = await _db.DevelopmentPlanGoals.FirstOrDefaultAsync(x => x.PlanId == planId && x.Id == goalId, ct);
        if (goal == null) return null;
        goal.Description = request.Description.Trim();
        goal.DueDate = request.DueDate;
        goal.ConcludedAt = request.ConcludedAt;
        goal.Order = request.Order;
        await _db.SaveChangesAsync(ct);
        return new DevelopmentPlanGoalResponse(goal.Id, goal.Description, goal.DueDate, goal.ConcludedAt, goal.Order);
    }

    public async Task<bool> DeleteGoalAsync(Guid planId, Guid goalId, Guid userId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var plan = await _db.DevelopmentPlans.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == planId && x.OwnerUserId == userId, ct);
        if (plan == null) return false;
        var goal = await _db.DevelopmentPlanGoals.FirstOrDefaultAsync(x => x.PlanId == planId && x.Id == goalId, ct);
        if (goal == null) return false;
        _db.DevelopmentPlanGoals.Remove(goal);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static DevelopmentPlanResponse MapToResponse(DevelopmentPlan p)
    {
        var goals = p.Goals
            .OrderBy(g => g.Order)
            .ThenBy(g => g.DueDate)
            .Select(g => new DevelopmentPlanGoalResponse(g.Id, g.Description, g.DueDate, g.ConcludedAt, g.Order))
            .ToList();
        return new DevelopmentPlanResponse(
            p.Id,
            p.OwnerUserId,
            p.OwnerUser?.FullName ?? "",
            p.TargetUserId,
            p.TargetUser?.FullName,
            p.Title,
            p.Description,
            p.CreatedAtUtc,
            p.UpdatedAtUtc,
            goals);
    }
}
