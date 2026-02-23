using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.ApiKeys;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.ApiKeys;

public sealed class ApiKeyService : IApiKeyService
{
    private const int KeyByteLength = 32;
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public ApiKeyService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<ApiKeyResponse>> ListAsync(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? string.Empty;
        var list = await _db.ApiKeys
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.Name)
            .Select(x => new ApiKeyResponse
            {
                Id = x.Id,
                Name = x.Name,
                Description = x.Description,
                IsActive = x.IsActive,
                CreatedAtUtc = x.CreatedAtUtc,
                LastUsedAtUtc = x.LastUsedAtUtc
            })
            .ToListAsync(ct);
        return list;
    }

    public async Task<ApiKeyResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? string.Empty;
        var entity = await _db.ApiKeys
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Id == id)
            .Select(x => new ApiKeyResponse
            {
                Id = x.Id,
                Name = x.Name,
                Description = x.Description,
                IsActive = x.IsActive,
                CreatedAtUtc = x.CreatedAtUtc,
                LastUsedAtUtc = x.LastUsedAtUtc
            })
            .FirstOrDefaultAsync(ct);
        return entity;
    }

    public async Task<ApiKeyCreateResponse> CreateAsync(ApiKeyCreateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? string.Empty;
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name))
            throw new ArgumentException("Name is required.", nameof(request));

        var rawKey = GenerateSecureKey();
        var keyHash = ComputeSha256Hash(rawKey);

        var entity = new ApiKey
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            KeyHash = keyHash,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.ApiKeys.Add(entity);
        await _db.SaveChangesAsync(ct);

        return new ApiKeyCreateResponse
        {
            Id = entity.Id,
            Name = entity.Name,
            Description = entity.Description,
            IsActive = entity.IsActive,
            CreatedAtUtc = entity.CreatedAtUtc,
            LastUsedAtUtc = entity.LastUsedAtUtc,
            Key = rawKey
        };
    }

    public async Task<bool> RevokeAsync(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? string.Empty;
        var entity = await _db.ApiKeys
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, ct);
        if (entity is null)
            return false;
        entity.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static string GenerateSecureKey()
    {
        var bytes = new byte[KeyByteLength];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static string ComputeSha256Hash(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}
