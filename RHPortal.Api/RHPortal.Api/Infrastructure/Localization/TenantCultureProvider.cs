using Microsoft.AspNetCore.Localization;
using Npgsql;
using RhPortal.Api.Application.Localization;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Infrastructure.Localization;

public sealed class TenantCultureProvider : RequestCultureProvider
{
    public override async Task<ProviderCultureResult?> DetermineProviderCultureResult(HttpContext httpContext)
    {
        var resetState = httpContext.RequestServices.GetService<ResetState>();
        if (resetState?.IsResetting == true)
            return null;

        var service = httpContext.RequestServices.GetRequiredService<ILocalizationConfigService>();
        (string? Culture, string? UiCulture)? config;
        try
        {
            config = await service.GetEffectiveAsync(httpContext.RequestAborted);
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            // During reset/migrate, the table may not exist yet; fall back to default culture.
            return null;
        }

        if (config is null)
            return null;

        var culture = config.Value.Culture;
        var uiCulture = config.Value.UiCulture;
        if (string.IsNullOrWhiteSpace(culture) && string.IsNullOrWhiteSpace(uiCulture))
            return null;

        if (string.IsNullOrWhiteSpace(uiCulture))
            uiCulture = culture;
        if (string.IsNullOrWhiteSpace(culture))
            culture = uiCulture;

        return new ProviderCultureResult(culture!, uiCulture!);
    }
}
