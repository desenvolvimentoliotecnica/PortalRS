using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Infrastructure.Tenancy;

public sealed class TenantMiddleware : IMiddleware
{
    public const string TenantHeaderName = "X-Tenant-Id";
    private static readonly Regex TenantPattern = new("^[a-z0-9][a-z0-9\\-]{1,62}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly ITenantContext _tenantContext;
    private readonly AppDbContext _db;

    public TenantMiddleware(ITenantContext tenantContext, AppDbContext db)
    {
        _tenantContext = tenantContext;
        _db = db;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        if (context.Request.Path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

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
                    "Tenant header is required.",
                    $"Missing header: {TenantHeaderName}");
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
                "Tenant header is required.",
                $"Header {TenantHeaderName} cannot be empty.");
            return;
        }

        var tenantIdentifier = rawTenantId.ToLowerInvariant();
        if (!TenantPattern.IsMatch(tenantIdentifier))
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                "Tenant identifier is invalid.",
                "Tenant identifier format is not valid.");
            return;
        }

        var tenantExists = await _db.Tenants
            .AsNoTracking()
            .AnyAsync(t => t.TenantId == tenantIdentifier && t.IsActive);

        if (!tenantExists)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                "Tenant is not active.",
                "Tenant does not exist or is inactive.");
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
