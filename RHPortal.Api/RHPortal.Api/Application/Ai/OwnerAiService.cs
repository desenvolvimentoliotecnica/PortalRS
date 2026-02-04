using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Application.Ai;

public interface IOwnerAiService
{
    Task<IReadOnlyList<AiProviderKeyListItemResponse>> ListKeysAsync(CancellationToken ct);
    Task<AiProviderKeyListItemResponse?> CreateKeyAsync(AiProviderKeyCreateRequest request, CancellationToken ct);
    Task<AiProviderKeyListItemResponse?> UpdateKeyAsync(Guid id, AiProviderKeyUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteKeyAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<AiModelListItemResponse>> ListModelsAsync(CancellationToken ct);
    Task<AiModelListItemResponse?> CreateModelAsync(AiModelCreateRequest request, CancellationToken ct);
    Task<AiModelListItemResponse?> UpdateModelAsync(Guid id, AiModelUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteModelAsync(Guid id, CancellationToken ct);

    Task<AiUsageSummaryByTenantResponse> GetUsageSummaryByTenantAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct);
    Task<AiUsageSummaryByUserResponse> GetUsageSummaryByUserAsync(string? tenantId, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct);
    Task<PagedResult<AiUsageDetailItem>> GetUsageDetailAsync(AiUsageDetailQuery query, CancellationToken ct);
}

public sealed class OwnerAiService : IOwnerAiService
{
    private readonly MasterDbContext _db;
    private readonly ISecretProtector _protector;

    public OwnerAiService(MasterDbContext db, ISecretProtector protector)
    {
        _db = db;
        _protector = protector;
    }

    public async Task<IReadOnlyList<AiProviderKeyListItemResponse>> ListKeysAsync(CancellationToken ct)
    {
        return await _db.AiProviderKeys
            .AsNoTracking()
            .OrderBy(x => x.Provider).ThenBy(x => x.Name)
            .Select(x => new AiProviderKeyListItemResponse(x.Id, x.Provider, x.Name, x.IsActive, x.IsDefault, x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<AiProviderKeyListItemResponse?> CreateKeyAsync(AiProviderKeyCreateRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var provider = request.Provider.Trim();
        var entity = new AiProviderKey
        {
            Id = Guid.NewGuid(),
            Provider = provider,
            Name = request.Name.Trim(),
            EncryptedKey = _protector.Encrypt(request.Key),
            IsActive = true,
            IsDefault = request.IsDefault,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        if (request.IsDefault)
            await _db.AiProviderKeys.Where(x => x.Provider == provider).ExecuteUpdateAsync(s => s.SetProperty(k => k.IsDefault, false), ct);
        _db.AiProviderKeys.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new AiProviderKeyListItemResponse(entity.Id, entity.Provider, entity.Name, entity.IsActive, entity.IsDefault, entity.CreatedAtUtc, entity.UpdatedAtUtc);
    }

    public async Task<AiProviderKeyListItemResponse?> UpdateKeyAsync(Guid id, AiProviderKeyUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.AiProviderKeys.FindAsync(new object[] { id }, ct);
        if (entity is null) return null;

        entity.Name = request.Name.Trim();
        entity.IsActive = request.IsActive;
        entity.IsDefault = request.IsDefault;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Key))
            entity.EncryptedKey = _protector.Encrypt(request.Key);
        if (request.IsDefault)
            await _db.AiProviderKeys.Where(x => x.Provider == entity.Provider && x.Id != id).ExecuteUpdateAsync(s => s.SetProperty(k => k.IsDefault, false), ct);

        await _db.SaveChangesAsync(ct);
        return new AiProviderKeyListItemResponse(entity.Id, entity.Provider, entity.Name, entity.IsActive, entity.IsDefault, entity.CreatedAtUtc, entity.UpdatedAtUtc);
    }

    public async Task<bool> DeleteKeyAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.AiProviderKeys.FindAsync(new object[] { id }, ct);
        if (entity is null) return false;
        _db.AiProviderKeys.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<AiModelListItemResponse>> ListModelsAsync(CancellationToken ct)
    {
        return await _db.AiModels
            .AsNoTracking()
            .Include(x => x.AiProviderKey)
            .OrderBy(x => x.AiProviderKey!.Provider).ThenBy(x => x.DisplayName)
            .Select(x => new AiModelListItemResponse(x.Id, x.AiProviderKeyId, x.ModelId, x.DisplayName, x.IsDefault))
            .ToListAsync(ct);
    }

    public async Task<AiModelListItemResponse?> CreateModelAsync(AiModelCreateRequest request, CancellationToken ct)
    {
        var keyExists = await _db.AiProviderKeys.AnyAsync(x => x.Id == request.AiProviderKeyId, ct);
        if (!keyExists) return null;

        var entity = new AiModel
        {
            Id = Guid.NewGuid(),
            AiProviderKeyId = request.AiProviderKeyId,
            ModelId = request.ModelId.Trim(),
            DisplayName = request.DisplayName.Trim(),
            IsDefault = request.IsDefault
        };
        if (request.IsDefault)
        {
            await _db.AiModels.Where(x => x.AiProviderKeyId == request.AiProviderKeyId).ExecuteUpdateAsync(s => s.SetProperty(m => m.IsDefault, false), ct);
        }
        _db.AiModels.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new AiModelListItemResponse(entity.Id, entity.AiProviderKeyId, entity.ModelId, entity.DisplayName, entity.IsDefault);
    }

    public async Task<AiModelListItemResponse?> UpdateModelAsync(Guid id, AiModelUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.AiModels.FindAsync(new object[] { id }, ct);
        if (entity is null) return null;

        entity.ModelId = request.ModelId.Trim();
        entity.DisplayName = request.DisplayName.Trim();
        entity.IsDefault = request.IsDefault;
        if (request.IsDefault)
        {
            await _db.AiModels.Where(x => x.AiProviderKeyId == entity.AiProviderKeyId && x.Id != id).ExecuteUpdateAsync(s => s.SetProperty(m => m.IsDefault, false), ct);
        }
        await _db.SaveChangesAsync(ct);
        return new AiModelListItemResponse(entity.Id, entity.AiProviderKeyId, entity.ModelId, entity.DisplayName, entity.IsDefault);
    }

    public async Task<bool> DeleteModelAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.AiModels.FindAsync(new object[] { id }, ct);
        if (entity is null) return false;
        _db.AiModels.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<AiUsageSummaryByTenantResponse> GetUsageSummaryByTenantAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var q = _db.AiUsageRecords.AsNoTracking();
        if (from.HasValue) q = q.Where(x => x.CreatedAtUtc >= from.Value);
        if (to.HasValue) q = q.Where(x => x.CreatedAtUtc <= to.Value);

        var byTenant = await q
            .GroupBy(x => x.TenantId)
            .Select(g => new AiUsageSummaryByTenantItem(g.Key, g.Sum(x => x.Cost), g.Count()))
            .OrderByDescending(x => x.TotalCost)
            .ToListAsync(ct);

        var totalCost = byTenant.Sum(x => x.TotalCost);
        var totalCount = byTenant.Sum(x => x.UsageCount);
        return new AiUsageSummaryByTenantResponse(byTenant, totalCost, totalCount);
    }

    public async Task<AiUsageSummaryByUserResponse> GetUsageSummaryByUserAsync(string? tenantId, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var q = _db.AiUsageRecords.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(tenantId)) q = q.Where(x => x.TenantId == tenantId);
        if (from.HasValue) q = q.Where(x => x.CreatedAtUtc >= from.Value);
        if (to.HasValue) q = q.Where(x => x.CreatedAtUtc <= to.Value);

        var byUser = await q
            .GroupBy(x => new { x.TenantId, x.UserId, x.UserName })
            .Select(g => new AiUsageSummaryByUserItem(g.Key.TenantId!, g.Key.UserId, g.Key.UserName, g.Sum(x => x.Cost), g.Count()))
            .OrderByDescending(x => x.TotalCost)
            .ToListAsync(ct);

        var totalCost = byUser.Sum(x => x.TotalCost);
        var totalCount = byUser.Sum(x => x.UsageCount);
        return new AiUsageSummaryByUserResponse(byUser, totalCost, totalCount);
    }

    public async Task<PagedResult<AiUsageDetailItem>> GetUsageDetailAsync(AiUsageDetailQuery query, CancellationToken ct)
    {
        IQueryable<AiUsageRecord> q = _db.AiUsageRecords.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.TenantId)) q = q.Where(x => x.TenantId == query.TenantId);
        if (query.UserId.HasValue) q = q.Where(x => x.UserId == query.UserId.Value);
        if (!string.IsNullOrWhiteSpace(query.Module)) q = q.Where(x => x.Module == query.Module);
        if (query.From.HasValue) q = q.Where(x => x.CreatedAtUtc >= query.From.Value);
        if (query.To.HasValue) q = q.Where(x => x.CreatedAtUtc <= query.To.Value);

        var totalItems = await q.CountAsync(ct);
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 200);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await q
            .Include(x => x.AiModel)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AiUsageDetailItem(
                x.Id,
                x.TenantId,
                x.UserId,
                x.UserName,
                x.Module,
                x.AiModel != null ? x.AiModel.DisplayName : null,
                x.Cost,
                x.ActionDescription,
                x.RequestMessage,
                x.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return new PagedResult<AiUsageDetailItem>(items, page, pageSize, totalItems, totalPages);
    }
}
