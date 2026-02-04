using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Logging.Context;
using RhPortal.Api.Logging.Entities;
using RhPortal.Api.Logging.Helpers;

namespace RhPortal.Api.Logging.Middleware;

public sealed class ExceptionLoggingMiddleware : IMiddleware
{
    private readonly AppDbContext _db;
    private readonly ILogContextAccessor _accessor;
    private readonly IAuditContextAccessor _auditAccessor;

    public ExceptionLoggingMiddleware(AppDbContext db, ILogContextAccessor accessor, IAuditContextAccessor auditAccessor)
    {
        _db = db;
        _accessor = accessor;
        _auditAccessor = auditAccessor;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            // Request cancelled by client: do not emit error logs.
            if (context.RequestAborted.IsCancellationRequested
                && (ex is OperationCanceledException || ex is TaskCanceledException))
            {
                throw;
            }

            if (context.Items.ContainsKey("__exception_logged"))
                throw;

            await TryLogExceptionAsync(ex, context, isHandled: false, statusCode: 500, tag: "unhandled");
            context.Items["__exception_logged"] = true;
            throw;
        }
    }

    private async Task TryLogExceptionAsync(Exception ex, HttpContext context, bool isHandled, int statusCode, string? tag)
    {
        var logContext = _accessor.Current;
        if (logContext is null) return;

        var entry = new ExceptionLog
        {
            Id = Guid.NewGuid(),
            TenantId = logContext.TenantId,
            RequestLogId = logContext.RequestLogId,
            TransactionId = logContext.TransactionId,
            EnvironmentName = logContext.EnvironmentName,
            EnvironmentNormalized = logContext.EnvironmentNormalized,
            DeviceId = logContext.DeviceId,
            DeviceType = logContext.DeviceType,
            Platform = logContext.Platform,
            Browser = logContext.Browser,
            DeviceAppVersion = logContext.DeviceAppVersion,
            Locale = logContext.Locale,
            Order = logContext.NextOrder(),
            OccurredAt = DateTimeOffset.UtcNow,
            IsHandled = isHandled,
            StatusCode = statusCode,
            ExceptionType = ex.GetType().FullName ?? "Exception",
            Message = MaskingAndTruncation.Truncate(ex.Message, 4096) ?? string.Empty,
            StackTrace = MaskingAndTruncation.Truncate(ex.StackTrace, 16384),
            InnerExceptionType = ex.InnerException?.GetType().FullName,
            InnerMessage = MaskingAndTruncation.Truncate(ex.InnerException?.Message, 4096),
            Tags = tag,
            CreatedAt = DateTimeOffset.UtcNow
        };

        try
        {
            using var suppress = _accessor.BeginSuppress();
            using var auditSuppress = _auditAccessor.BeginSuppress();
            _db.ExceptionLogs.Add(entry);
            await _db.SaveChangesAsync(context.RequestAborted);
        }
        catch
        {
            // best-effort
        }
    }
}
