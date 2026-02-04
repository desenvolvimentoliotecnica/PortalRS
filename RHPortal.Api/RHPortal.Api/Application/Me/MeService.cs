using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Authentication;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Application.Authentication;

namespace RhPortal.Api.Application.Me;

public sealed class MeService
{
    private readonly MasterDbContext _masterDb;
    private readonly OwnerAuthService _ownerAuthService;
    private readonly AuthenticationService _authService;

    public MeService(
        MasterDbContext masterDb,
        OwnerAuthService ownerAuthService,
        AuthenticationService authService)
    {
        _masterDb = masterDb;
        _ownerAuthService = ownerAuthService;
        _authService = authService;
    }

    public async Task<AllowedTenantsResponse> GetAllowedTenantsAsync(ClaimsPrincipal user, CancellationToken ct)
    {
        if (user.IsInRole("Owner"))
        {
            var tenants = await _masterDb.Tenants
                .AsNoTracking()
                .Where(x => x.IsActive)
                .OrderBy(x => x.TenantId)
                .Select(x => new AllowedTenantItem(x.TenantId, x.Name))
                .ToListAsync(ct);
            var list = new List<AllowedTenantItem> { new("owner", "Área Owner") };
            list.AddRange(tenants);
            return new AllowedTenantsResponse(list);
        }

        var currentTenantId = user.FindFirstValue("tenant")?.Trim();
        if (string.IsNullOrWhiteSpace(currentTenantId))
        {
            return new AllowedTenantsResponse(Array.Empty<AllowedTenantItem>());
        }

        var tenant = await _masterDb.Tenants
            .AsNoTracking()
            .Where(x => x.TenantId == currentTenantId && x.IsActive)
            .Select(x => new AllowedTenantItem(x.TenantId, x.Name))
            .FirstOrDefaultAsync(ct);
        if (tenant is null)
        {
            return new AllowedTenantsResponse(new[] { new AllowedTenantItem(currentTenantId, currentTenantId) });
        }
        return new AllowedTenantsResponse(new[] { tenant });
    }

    public async Task<SwitchTenantResponse?> SwitchTenantAsync(ClaimsPrincipal user, string requestedTenantId, CancellationToken ct)
    {
        var allowed = await GetAllowedTenantsAsync(user, ct);
        var allowedIds = allowed.Tenants.Select(x => x.TenantId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!allowedIds.Contains(requestedTenantId))
        {
            return null;
        }

        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (user.IsInRole("Owner"))
        {
            if (!Guid.TryParse(userIdClaim, out var ownerId))
                return null;
            var token = _ownerAuthService.CreateJwtTokenWithTenant(ownerId, requestedTenantId);
            return new SwitchTenantResponse(token, requestedTenantId);
        }

        if (!Guid.TryParse(userIdClaim, out var uid))
            return null;
        var accessToken = await _authService.CreateTokenWithTenantAsync(uid, requestedTenantId, ct);
        if (accessToken is null)
            return null;
        return new SwitchTenantResponse(accessToken, requestedTenantId);
    }

    public async Task<CurrentUserResponse?> GetCurrentUserAsync(ClaimsPrincipal user, CancellationToken ct)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var uid))
            return null;
        return await _authService.GetCurrentUserAsync(uid, ct);
    }
}
