using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace LioTecnica.Web.Infrastructure.Security;

public sealed class ApiAuthenticationHandler : DelegatingHandler
{
    private const string TenantHeader = "X-Tenant-Id";
    private const string OpsResetHeader = "X-OPS-RESET-KEY";

    /// <summary>When set (e.g. on Owner/Tenants/{tenantId}/Config/*), API calls use this tenant instead of "owner".</summary>
    public const string OwnerConfigTenantIdKey = "OwnerConfigTenantId";

    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IConfiguration _config;

    public ApiAuthenticationHandler(IHttpContextAccessor httpContextAccessor, IConfiguration config)
    {
        _httpContextAccessor = httpContextAccessor;
        _config = config;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var httpContext = _httpContextAccessor.HttpContext;

        // 🔐 Auth + Tenant
        if (httpContext?.User?.Identity?.IsAuthenticated == true)
        {
            var isOwnerPath = request.RequestUri?.AbsolutePath?.Contains("owner", StringComparison.OrdinalIgnoreCase) == true;
            // For api/owner/* use Owner token from cookie when present (survives SwitchTenant)
            var token = isOwnerPath && httpContext.Request.Cookies.TryGetValue("OwnerAccessToken", out var ownerToken) && !string.IsNullOrWhiteSpace(ownerToken)
                ? ownerToken
                : httpContext.User.FindFirst("access_token")?.Value;

            var tenantId = httpContext.User.FindFirst("tenant")?.Value;
            // When Owner is on tenant config tabs, use that tenant for non-owner API calls so data is read/written in that tenant's DB
            if (!isOwnerPath && IsOwner(httpContext))
            {
                if (httpContext.Items.TryGetValue(OwnerConfigTenantIdKey, out var configTenant) && configTenant is string ct && !string.IsNullOrWhiteSpace(ct))
                    tenantId = ct;
                else if (string.IsNullOrWhiteSpace(tenantId) && httpContext.Request.Cookies.TryGetValue("OwnerConfigTenantId", out var cookieVal) && !string.IsNullOrWhiteSpace(cookieVal))
                    tenantId = cookieVal;
            }
            if (!string.IsNullOrWhiteSpace(tenantId) && !request.Headers.Contains(TenantHeader))
                request.Headers.TryAddWithoutValidation(TenantHeader, tenantId);
            // For api/owner/* send tenant "owner" so API validation passes
            if (isOwnerPath && !string.IsNullOrWhiteSpace(token) && request.Headers.Contains(TenantHeader))
            {
                request.Headers.Remove(TenantHeader);
                request.Headers.TryAddWithoutValidation(TenantHeader, "owner");
            }

            var hasToken = !string.IsNullOrWhiteSpace(token);
            if (hasToken && request.Headers.Authorization is null)
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        // 🔐 OPS Reset Key (somente no endpoint de reset)
        // Coloque a mesma chave no appsettings do FRONT e da API:
        // "Ops": { "ResetKey": "..." }
        var resetKey = _config.GetValue<string>("Ops:ResetKey");

        if (!string.IsNullOrWhiteSpace(resetKey) && IsOpsResetEndpoint(request))
        {
            // garante sobrescrever caso algum outro handler tenha colocado
            request.Headers.Remove(OpsResetHeader);
            request.Headers.TryAddWithoutValidation(OpsResetHeader, resetKey);
        }

        var response = await base.SendAsync(request, cancellationToken);

        // sinaliza para o middleware do front redirecionar quando a API der 401
        if (response.StatusCode == HttpStatusCode.Unauthorized && httpContext is not null)
        {
            httpContext.Items["ApiUnauthorized"] = true;
        }

        return response;
    }

    private static bool IsOwner(HttpContext? context)
    {
        if (context?.User?.Identity?.IsAuthenticated != true) return false;
        if (context.User.IsInRole("Owner")) return true;
        return !string.IsNullOrWhiteSpace(context.Request.Cookies["OwnerAccessToken"]);
    }

    private static bool IsOpsResetEndpoint(HttpRequestMessage request)
    {
        if (request.RequestUri is null) return false;

        // AbsolutePath vem sem querystring. Pode ser:
        // "/api/ops/reset-database" OU "/ops/reset-database" dependendo de como você montou as URLs.
        var path = request.RequestUri.AbsolutePath ?? string.Empty;

        // mais tolerante (evita o bug "não enviou a key")
        return path.EndsWith("/ops/reset-database", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/api/ops/reset-database", StringComparison.OrdinalIgnoreCase)
            || path.Contains("/ops/reset-database", StringComparison.OrdinalIgnoreCase);
    }
}
