using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace LioTecnica.Web.Infrastructure.Security;

public sealed class TenantValidationMiddleware
{
    private static readonly Regex TenantPattern = new("^[a-z0-9][a-z0-9\\-]{1,62}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private readonly RequestDelegate _next;

    public TenantValidationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true &&
            !context.Request.Path.StartsWithSegments("/Account/Login", StringComparison.OrdinalIgnoreCase))
        {
            var tenantId = context.User.FindFirst("tenant")?.Value?.Trim();
            if (!IsValidTenantIdentifier(tenantId))
            {
                await context.SignOutAsync();
                context.Response.Redirect("/Account/Login");
                return;
            }
        }

        await _next(context);
    }

    public static bool IsValidTenantIdentifier(string? tenantId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return false;

        return TenantPattern.IsMatch(tenantId);
    }
}
