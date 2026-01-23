using Microsoft.AspNetCore.Localization;
using RhPortal.Api.Application.Localization;

namespace RhPortal.Api.Infrastructure.Localization;

public sealed class TenantCultureProvider : RequestCultureProvider
{
    public override async Task<ProviderCultureResult?> DetermineProviderCultureResult(HttpContext httpContext)
    {
        var service = httpContext.RequestServices.GetRequiredService<ILocalizationConfigService>();
        var config = await service.GetEffectiveAsync(httpContext.RequestAborted);
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
