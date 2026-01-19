using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Logging.Context;
using RhPortal.Api.Logging.Entities;
using RhPortal.Api.Logging.Helpers;

namespace RhPortal.Api.Logging.Middleware;

public sealed class RequestLogMiddleware : IMiddleware
{
    private const int MaxSnippetBytes = 4 * 1024;
    private static readonly string[] SkipBodyPrefixes =
    [
        "/api/auth",
        "/health",
        "/metrics",
        "/swagger"
    ];

    private static readonly string[] AllowedContentTypes =
    [
        "application/json",
        "application/problem+json",
        "text/"
    ];

    private readonly ITenantContext _tenantContext;
    private readonly AppDbContext _db;
    private readonly ILogContextAccessor _accessor;
    private readonly IAuditContextAccessor _auditAccessor;
    private readonly IHostEnvironment _env;

    public RequestLogMiddleware(
        ITenantContext tenantContext,
        AppDbContext db,
        ILogContextAccessor accessor,
        IAuditContextAccessor auditAccessor,
        IHostEnvironment env)
    {
        _tenantContext = tenantContext;
        _db = db;
        _accessor = accessor;
        _auditAccessor = auditAccessor;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var tenantId = string.IsNullOrWhiteSpace(_tenantContext.TenantId) ? "system" : _tenantContext.TenantId;
        var transactionId = context.Request.Headers["X-Transaction-Id"].FirstOrDefault()
            ?? context.TraceIdentifier
            ?? Guid.NewGuid().ToString("N");
        var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
            ?? Activity.Current?.Id;
        var traceId = Activity.Current?.TraceId.ToString();

        var (envName, envNormalized) = EnvironmentResolver.Resolve(_env);
        var device = DeviceResolver.Resolve(context);

        var startedAt = DateTimeOffset.UtcNow;
        var sw = Stopwatch.StartNew();

        var requestLog = new RequestLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TransactionId = transactionId,
            CorrelationId = correlationId,
            TraceId = traceId,
            EnvironmentName = envName,
            EnvironmentNormalized = envNormalized,
            DeviceId = device.DeviceId,
            DeviceType = device.DeviceType,
            Platform = device.Platform,
            Browser = device.Browser,
            DeviceAppVersion = device.DeviceAppVersion,
            Locale = device.Locale,
            StartedAt = startedAt,
            Method = context.Request.Method,
            Path = context.Request.Path,
            QueryString = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : null,
            UserId = context.User.FindFirstValue(ClaimTypes.NameIdentifier),
            UserName = context.User.FindFirstValue(ClaimTypes.Name) ?? context.User.Identity?.Name,
            ClientId = context.User.FindFirstValue("client_id"),
            Ip = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                 ?? context.Connection.RemoteIpAddress?.ToString(),
            UserAgent = context.Request.Headers.UserAgent.ToString(),
            Host = context.Request.Host.Value,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var endpoint = context.GetEndpoint();
        if (endpoint is RouteEndpoint route)
            requestLog.RouteTemplate = route.RoutePattern.RawText;
        var actionDescriptor = endpoint?.Metadata.GetMetadata<ControllerActionDescriptor>();
        requestLog.Controller = actionDescriptor?.ControllerName;
        requestLog.Action = actionDescriptor?.ActionName;

        if (ShouldCaptureBody(context.Request))
        {
            context.Request.EnableBuffering();
            var bodyText = await ReadSnippetAsync(context.Request.Body, MaxSnippetBytes, context.RequestAborted);
            requestLog.RequestBodySnippet = MaskingAndTruncation.MaskJson(bodyText);
        }

        var logContext = new LogContext
        {
            RequestLogId = requestLog.Id,
            TenantId = tenantId,
            TransactionId = transactionId,
            CorrelationId = correlationId,
            TraceId = traceId,
            EnvironmentName = envName,
            EnvironmentNormalized = envNormalized,
            DeviceId = device.DeviceId,
            DeviceType = device.DeviceType,
            Platform = device.Platform,
            Browser = device.Browser,
            DeviceAppVersion = device.DeviceAppVersion,
            Locale = device.Locale
        };

        using var scope = _accessor.BeginScope(logContext);

        try
        {
            using var suppress = _accessor.BeginSuppress();
            using var auditSuppress = _auditAccessor.BeginSuppress();
            _db.RequestLogs.Add(requestLog);
            await _db.SaveChangesAsync(context.RequestAborted);
        }
        catch
        {
            // best-effort
        }

        await next(context);

        sw.Stop();
        requestLog.EndedAt = startedAt.Add(sw.Elapsed);
        requestLog.DurationMs = (long)sw.Elapsed.TotalMilliseconds;
        requestLog.StatusCode = context.Response.StatusCode;
        requestLog.IsSuccess = context.Response.StatusCode < 500;
        requestLog.ErrorCount = logContext.ErrorCount;
        requestLog.WarningCount = logContext.WarningCount;

        if (ShouldCaptureResponse(context.Response))
        {
            // Note: response body capture should be done by other middleware if needed.
        }

        try
        {
            using var suppress = _accessor.BeginSuppress();
            using var auditSuppress = _auditAccessor.BeginSuppress();
            _db.RequestLogs.Update(requestLog);
            await _db.SaveChangesAsync(context.RequestAborted);
        }
        catch
        {
            // best-effort
        }
    }

    private static bool ShouldCaptureBody(HttpRequest request)
    {
        if (SkipBodyPrefixes.Any(p => request.Path.StartsWithSegments(p, StringComparison.OrdinalIgnoreCase)))
            return false;
        if (request.ContentType is null) return false;
        return AllowedContentTypes.Any(ct =>
            ct.EndsWith("/") ? request.ContentType.StartsWith(ct, StringComparison.OrdinalIgnoreCase)
                : request.ContentType.Contains(ct, StringComparison.OrdinalIgnoreCase));
    }

    private static bool ShouldCaptureResponse(HttpResponse response)
    {
        if (response.ContentType is null) return false;
        return AllowedContentTypes.Any(ct =>
            ct.EndsWith("/") ? response.ContentType.StartsWith(ct, StringComparison.OrdinalIgnoreCase)
                : response.ContentType.Contains(ct, StringComparison.OrdinalIgnoreCase));
    }

    private static async Task<string?> ReadSnippetAsync(Stream body, int maxBytes, CancellationToken ct)
    {
        body.Seek(0, SeekOrigin.Begin);
        using var ms = new MemoryStream();
        var buffer = new byte[1024];
        int read;
        while ((read = await body.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
        {
            var toWrite = Math.Min(read, maxBytes - (int)ms.Length);
            if (toWrite > 0)
                ms.Write(buffer, 0, toWrite);
            if (ms.Length >= maxBytes)
                break;
        }
        body.Seek(0, SeekOrigin.Begin);
        if (ms.Length == 0) return null;
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }
}
