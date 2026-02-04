using Microsoft.AspNetCore.Http;

namespace LioTecnica.Web.Infrastructure.Security;

public sealed class PortalTenantContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PortalTenantContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    /// <summary>Tenant from the "tenant" claim. Empty when missing so callers can return 400 instead of 500.</summary>
    public string TenantId
    {
        get
        {
            var tenantId = _httpContextAccessor.HttpContext?.User?.FindFirst("tenant")?.Value;
            return string.IsNullOrWhiteSpace(tenantId) ? string.Empty : tenantId;
        }
    }
}
