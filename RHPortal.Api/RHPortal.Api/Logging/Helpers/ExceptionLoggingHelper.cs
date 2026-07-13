using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Logging.Context;
using RhPortal.Api.Logging.Entities;
using RhPortal.Api.Logging.Helpers;

namespace RhPortal.Api.Logging.Helpers;

public static class ExceptionLoggingHelper
{
    // TODO: use this helper in domain-specific handlers where exceptions are manually handled.
    public static async Task LogHandledExceptionAsync(
        HttpContext context,
        ILogContextAccessor accessor,
        AppDbContext db,
        Exception ex,
        int statusCode,
        string? tag = null,
        object? validationErrors = null)
    {
        if (context.Items.ContainsKey("__exception_logged"))
            return;

        var logContext = accessor.Current;
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
            IsHandled = true,
            StatusCode = statusCode,
            ExceptionType = ex.GetType().FullName ?? "Exception",
            Message = MaskingAndTruncation.Truncate(ex.Message, 4096) ?? "Exception",
            StackTrace = MaskingAndTruncation.Truncate(ex.StackTrace, 16384),
            InnerExceptionType = ex.InnerException?.GetType().FullName,
            InnerMessage = MaskingAndTruncation.Truncate(ex.InnerException?.Message, 4096),
            ValidationErrorsJson = validationErrors is null ? null : System.Text.Json.JsonSerializer.Serialize(validationErrors),
            Tags = tag,
            CreatedAt = DateTimeOffset.UtcNow
        };

        try
        {
            using var suppress = accessor.BeginSuppress();
            var auditAccessor = context.RequestServices.GetRequiredService<IAuditContextAccessor>();
            using var auditSuppress = auditAccessor.BeginSuppress();
            db.ExceptionLogs.Add(entry);
            await db.SaveChangesAsync(context.RequestAborted);
            context.Items["__exception_logged"] = true;
        }
        catch
        {
            var tracked = db.ChangeTracker.Entries<ExceptionLog>()
                .FirstOrDefault(e => ReferenceEquals(e.Entity, entry) || e.Entity.Id == entry.Id);
            if (tracked is not null)
                tracked.State = Microsoft.EntityFrameworkCore.EntityState.Detached;
        }
    }
}
