using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.Extensions;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Auditing.Entities;
using RhPortal.Api.Auditing.Helpers;
using RhPortal.Api.Auditing.Services;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Auditing.Middleware;

public sealed class AuditMiddleware : IMiddleware
{
    private const int MaxBodyBytes = 64 * 1024;
    private static readonly string[] SkipPrefixes =
    [
        "/health",
        "/metrics",
        "/swagger",
        "/favicon.ico",
        "/_framework",
        "/api/auth"
    ];

    private static readonly string[] SkipExact =
    [
        "/api/auth/login",
        "/api/auth/refresh"
    ];

    private static readonly string[] AllowedContentTypes =
    [
        "application/json",
        "application/problem+json",
        "text/"
    ];

    private readonly IAuditContextAccessor _accessor;
    private readonly AuditWriter _writer;
    private readonly ITenantContext _tenantContext;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AuditMiddleware> _logger;

    public AuditMiddleware(
        IAuditContextAccessor accessor,
        AuditWriter writer,
        ITenantContext tenantContext,
        IWebHostEnvironment env,
        ILogger<AuditMiddleware> logger)
    {
        _accessor = accessor;
        _writer = writer;
        _tenantContext = tenantContext;
        _env = env;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        if (ShouldSkip(context.Request.Path))
        {
            await next(context);
            return;
        }

        var auditContext = CreateContext(context);
        using var scope = _accessor.BeginScope(auditContext);
        var httpOrder = auditContext.NextOrder();

        var transactionId = auditContext.TransactionId;
        var startedAt = auditContext.StartedAt;
        var sw = Stopwatch.StartNew();

        AuditBodyCapture? requestBody = null;
        if (ShouldCaptureRequestBody(context.Request))
        {
            context.Request.EnableBuffering();
            requestBody = await AuditBodyReader.ReadAsync(context.Request.Body, MaxBodyBytes, context.RequestAborted);
            if (requestBody?.Text is { } text)
                requestBody = new AuditBodyCapture
                {
                    Text = AuditJsonMasker.MaskSensitiveJson(text),
                    Hash = requestBody.Hash,
                    IsTruncated = requestBody.IsTruncated,
                    TruncatedBytes = requestBody.TruncatedBytes
                };
        }

        var originalBody = context.Response.Body;
        await using var responseBuffer = new MemoryStream();
        context.Response.Body = responseBuffer;

        Exception? exception = null;

        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            exception = ex;
            throw;
        }
        finally
        {
            sw.Stop();
            context.Response.Body = originalBody;

            // Client disconnected or request was cancelled: avoid noisy audit failures.
            var canceled = IsCancellation(exception, context);

            if (!canceled)
            {
                responseBuffer.Seek(0, SeekOrigin.Begin);
                AuditBodyCapture? responseBody = null;
                if (ShouldCaptureResponseBody(context.Response))
                {
                    responseBody = await AuditBodyReader.ReadAsync(responseBuffer, MaxBodyBytes, CancellationToken.None);
                }
                responseBuffer.Seek(0, SeekOrigin.Begin);
                await responseBuffer.CopyToAsync(originalBody, CancellationToken.None);

                try
                {
                    await PersistAuditAsync(context, auditContext, httpOrder, startedAt, sw.Elapsed, requestBody, responseBody, exception);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Audit middleware failed to persist logs.");
                }
            }
        }
    }

    private async Task PersistAuditAsync(
        HttpContext context,
        AuditContext auditContext,
        int httpOrder,
        DateTimeOffset startedAt,
        TimeSpan elapsed,
        AuditBodyCapture? requestBody,
        AuditBodyCapture? responseBody,
        Exception? exception)
    {
        var transactionId = auditContext.TransactionId;
        var tenantId = auditContext.TenantId;
        _logger.LogDebug("AuditMiddleware.PersistAuditAsync: TenantId={TenantId}, Path={Path}", tenantId, context.Request.Path);

        var auditTransactionId = await _writer.EnsureTransactionAsync(auditContext, context.RequestAborted);
        auditContext.AuditTransactionId = auditTransactionId;

        var endpoint = context.GetEndpoint();
        var actionDescriptor = endpoint?.Metadata.GetMetadata<Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor>();

        var transaction = new AuditTransaction
        {
            Id = auditTransactionId,
            TenantId = tenantId,
            TransactionId = transactionId,
            CorrelationId = auditContext.CorrelationId,
            TraceId = auditContext.TraceId,
            SpanId = auditContext.SpanId,
            ParentSpanId = auditContext.ParentSpanId,
            Environment = Limit(auditContext.Environment, 40) ?? string.Empty,
            AppVersion = Limit(auditContext.AppVersion, 40) ?? string.Empty,
            StartedAt = startedAt,
            EndedAt = startedAt.Add(elapsed),
            DurationMs = (long)elapsed.TotalMilliseconds,
            UserId = Limit(auditContext.UserId, 120),
            UserName = Limit(auditContext.UserName, 200),
            ClientId = Limit(auditContext.ClientId, 120),
            Ip = Limit(context.Connection.RemoteIpAddress?.ToString(), 80),
            UserAgent = Limit(context.Request.Headers.UserAgent.ToString(), 400),
            Host = Limit(context.Request.Host.Value, 200),
            Method = Limit(context.Request.Method, 16) ?? context.Request.Method,
            Path = Limit(context.Request.Path, 512) ?? context.Request.Path,
            QueryString = Limit(context.Request.QueryString.HasValue ? context.Request.QueryString.Value : null, 1024),
            RouteTemplate = Limit((endpoint as RouteEndpoint)?.RoutePattern.RawText, 512),
            Controller = Limit(actionDescriptor?.ControllerName, 120),
            Action = Limit(actionDescriptor?.ActionName, 120),
            StatusCode = context.Response.StatusCode,
            IsSuccess = exception is null && context.Response.StatusCode < 500,
            RequestContentType = context.Request.ContentType,
            ResponseContentType = context.Response.ContentType,
            RequestBody = requestBody?.Text,
            ResponseBody = responseBody?.Text,
            RequestBodyHash = requestBody?.Hash,
            ResponseBodyHash = responseBody?.Hash,
            RequestIsTruncated = requestBody?.IsTruncated ?? false,
            ResponseIsTruncated = responseBody?.IsTruncated ?? false,
            RequestTruncatedBytes = requestBody?.TruncatedBytes ?? 0,
            ResponseTruncatedBytes = responseBody?.TruncatedBytes ?? 0,
            ErrorMessage = Limit(exception?.Message, 2000),
            ErrorStackTrace = exception is null ? null : Limit(exception.StackTrace, 2000),
            CreatedAt = DateTimeOffset.UtcNow
        };

        var events = new List<AuditEvent>
        {
            new()
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                AuditTransactionId = auditTransactionId,
                Order = httpOrder,
                EventType = "HTTP",
                Name = "HTTP Request",
                OccurredAt = DateTimeOffset.UtcNow,
                DataJson = null,
                CreatedAt = DateTimeOffset.UtcNow
            }
        };

        if (exception is not null)
        {
            events.Add(new AuditEvent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                AuditTransactionId = auditTransactionId,
                Order = auditContext.NextOrder(),
                EventType = "EXCEPTION",
                Name = "UnhandledException",
                OccurredAt = DateTimeOffset.UtcNow,
                DataJson = $"{{\"message\":\"{EscapeJson(exception.Message)}\"}}",
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await _writer.WriteHttpAsync(transaction, events, context.RequestAborted);
    }

    private AuditContext CreateContext(HttpContext context)
    {
        var trace = Activity.Current;
        var transactionId = context.Request.Headers["X-Transaction-Id"].FirstOrDefault()
            ?? context.TraceIdentifier
            ?? Guid.NewGuid().ToString("N");

        var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
            ?? trace?.Id;

        var user = context.User;
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        var userName = user.FindFirstValue(ClaimTypes.Name) ?? user.Identity?.Name;
        var clientId = user.FindFirstValue("client_id");

        return new AuditContext
        {
            TenantId = string.IsNullOrWhiteSpace(_tenantContext.TenantId) ? "system" : _tenantContext.TenantId,
            TransactionId = transactionId,
            CorrelationId = correlationId,
            TraceId = trace?.TraceId.ToString(),
            SpanId = trace?.SpanId.ToString(),
            ParentSpanId = trace?.ParentSpanId.ToString(),
            UserId = userId,
            UserName = userName,
            ClientId = clientId,
            Environment = _env.EnvironmentName,
            AppVersion = typeof(AuditMiddleware).Assembly.GetName().Version?.ToString() ?? "unknown",
            StartedAt = DateTimeOffset.UtcNow
        };
    }

    private static bool ShouldSkip(PathString path)
    {
        var value = path.Value ?? string.Empty;
        if (SkipExact.Any(x => value.Equals(x, StringComparison.OrdinalIgnoreCase)))
            return true;
        return SkipPrefixes.Any(prefix => value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
    }

    private static bool ShouldCaptureRequestBody(HttpRequest request)
    {
        if (request.ContentType is null)
            return false;
        if (request.ContentType.StartsWith("multipart/form-data", StringComparison.OrdinalIgnoreCase))
            return false;
        return AllowedContentTypes.Any(ct =>
            ct.EndsWith("/") ? request.ContentType.StartsWith(ct, StringComparison.OrdinalIgnoreCase)
                : request.ContentType.Contains(ct, StringComparison.OrdinalIgnoreCase));
    }

    private static bool ShouldCaptureResponseBody(HttpResponse response)
    {
        if (response.ContentType is null)
            return false;
        return AllowedContentTypes.Any(ct =>
            ct.EndsWith("/") ? response.ContentType.StartsWith(ct, StringComparison.OrdinalIgnoreCase)
                : response.ContentType.Contains(ct, StringComparison.OrdinalIgnoreCase));
    }

    private static string? Truncate(string? value, int max)
        => string.IsNullOrWhiteSpace(value) ? value : (value.Length <= max ? value : value.Substring(0, max));

    private static string EscapeJson(string value)
        => value.Replace("\\", "\\\\").Replace("\"", "\\\"");

    private static string? Limit(string? value, int max)
        => string.IsNullOrWhiteSpace(value) ? value : (value.Length <= max ? value : value[..max]);

    private static bool IsCancellation(Exception? ex, HttpContext context)
        => context.RequestAborted.IsCancellationRequested
           || ex is OperationCanceledException
           || ex is TaskCanceledException;
}
