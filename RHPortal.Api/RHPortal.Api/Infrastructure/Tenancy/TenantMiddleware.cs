using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Infrastructure.Tenancy;

public sealed class TenantMiddleware : IMiddleware
{
    public const string TenantHeaderName = "X-Tenant-Id";
    private static readonly Regex TenantPattern = new("^[a-z0-9][a-z0-9\\-]{1,62}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly string[] PublicPathsWithoutTenant = new[] { "/health", "/api/health", "/swagger", "/api/auth/auto-login" };

    private readonly ITenantContext _tenantContext;
    private readonly MasterDbContext _masterDb;
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;

    public TenantMiddleware(
        ITenantContext tenantContext,
        MasterDbContext masterDb,
        IStringLocalizer<InfrastructureMessages> localizer)
    {
        _tenantContext = tenantContext;
        _masterDb = masterDb;
        _localizer = localizer;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var reqPath = context.Request.Path.Value ?? "";
        if (PublicPathsWithoutTenant.Any(p => context.Request.Path.StartsWithSegments(p, StringComparison.OrdinalIgnoreCase)))
        {
            await next(context);
            return;
        }

        if (context.Request.Path.StartsWithSegments("/api/owner", StringComparison.OrdinalIgnoreCase))
        {
            _tenantContext.SetTenantId("owner");
            await next(context);
            return;
        }

        // email-config: resolve tenant do header sem exigir auth (owner gerencia tenant)
        if (context.Request.Path.StartsWithSegments("/api/email-config", StringComparison.OrdinalIgnoreCase))
        {
            var tid = context.Request.Headers["X-Tenant-Id"].ToString().Trim();
            if (!string.IsNullOrWhiteSpace(tid))
                _tenantContext.SetTenantId(tid);
            await next(context);
            return;
        }

        // /api/ops também precisa de X-Tenant-Id para endpoints como clean-candidatos-talentos (eliminar no tenant correto, ex.: liotecnica).
        // SignalR/WebSocket clients cannot reliably send custom headers.
        // For hub connections we allow the tenant id to come from the query string.
        string rawTenantId;
        if (!context.Request.Headers.TryGetValue(TenantHeaderName, out var tenantValues))
        {
            rawTenantId = context.Request.Query["tenantId"].ToString().Trim();
            if (string.IsNullOrWhiteSpace(rawTenantId))
            {
                await WriteProblemAsync(
                    context,
                    StatusCodes.Status400BadRequest,
                    _localizer["InfrastructureErrors.TenantHeaderRequiredTitle"],
                    _localizer["InfrastructureErrors.TenantHeaderMissingDetail", TenantHeaderName]);
                return;
            }
        }
        else
        {
            rawTenantId = tenantValues.ToString().Trim();
        }
        if (string.IsNullOrWhiteSpace(rawTenantId))
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                _localizer["InfrastructureErrors.TenantHeaderRequiredTitle"],
                _localizer["InfrastructureErrors.TenantHeaderEmptyDetail", TenantHeaderName]);
            return;
        }

        var tenantIdentifier = rawTenantId.ToLowerInvariant();
        if (!TenantPattern.IsMatch(tenantIdentifier))
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                _localizer["InfrastructureErrors.TenantIdentifierInvalidTitle"],
                _localizer["InfrastructureErrors.TenantIdentifierInvalidDetail"]);
            return;
        }

        if (tenantIdentifier == "owner")
        {
            _tenantContext.SetTenantId(tenantIdentifier);
            await next(context);
            return;
        }

        var tenantExists = await _masterDb.Tenants
            .AsNoTracking()
            .AnyAsync(t => t.TenantId == tenantIdentifier && t.IsActive);

        if (!tenantExists)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                _localizer["InfrastructureErrors.TenantInactiveTitle"],
                _localizer["InfrastructureErrors.TenantInactiveDetail"]);
            return;
        }

        _tenantContext.SetTenantId(tenantIdentifier);
        await next(context);
    }

    private static async Task WriteProblemAsync(HttpContext context, int statusCode, string title, string detail)
    {
        if (context.Response.HasStarted) return;

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail
        };

        await context.Response.WriteAsJsonAsync(problem);
    }
}
