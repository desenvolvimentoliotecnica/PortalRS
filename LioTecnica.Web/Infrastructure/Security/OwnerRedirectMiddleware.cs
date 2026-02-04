using Microsoft.AspNetCore.Http;

namespace LioTecnica.Web.Infrastructure.Security;

/// <summary>
/// Redireciona usuários Owner para a página principal do Owner (/Owner/Tenants)
/// quando acessam a raiz (/) ou o Dashboard, forçando a entrada na tela de tenants.
/// </summary>
public sealed class OwnerRedirectMiddleware
{
    private readonly RequestDelegate _next;

    public OwnerRedirectMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true &&
            context.User.IsInRole("Owner"))
        {
            var tenant = context.User.FindFirst("tenant")?.Value?.Trim();
            var isOwnerContext = string.IsNullOrEmpty(tenant) ||
                string.Equals(tenant, "owner", StringComparison.OrdinalIgnoreCase);

            if (isOwnerContext)
            {
                var path = context.Request.Path.Value?.TrimEnd('/') ?? "";
                var isGet = string.Equals(context.Request.Method, "GET", StringComparison.OrdinalIgnoreCase);

                if (isGet && ShouldRedirectToOwnerTenants(path))
                {
                    context.Response.Redirect("/Owner/Tenants", permanent: false);
                    return;
                }
            }
        }

        await _next(context);
    }

    private static bool ShouldRedirectToOwnerTenants(string path)
    {
        if (string.IsNullOrEmpty(path) || path == "/")
            return true;
        if (path.Equals("/Dashboard", StringComparison.OrdinalIgnoreCase))
            return true;
        if (path.Equals("/Dashboard/Index", StringComparison.OrdinalIgnoreCase))
            return true;
        if (path.Equals("/Owner", StringComparison.OrdinalIgnoreCase))
            return true;
        return false;
    }
}
