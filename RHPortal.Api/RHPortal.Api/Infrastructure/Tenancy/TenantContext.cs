using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Infrastructure.Tenancy;

public interface ITenantContext
{
    string TenantId { get; }
    void SetTenantId(string tenantId);
}

public sealed class TenantContext : ITenantContext
{
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;

    public TenantContext(IStringLocalizer<InfrastructureMessages> localizer)
    {
        _localizer = localizer;
    }

    public string TenantId { get; private set; } = string.Empty;

    public void SetTenantId(string tenantId)
    {
        var value = tenantId?.Trim();
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException(_localizer["InfrastructureErrors.TenantIdentifierRequired"]);

        TenantId = value;
    }
}
