using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Logging.Context;
using RhPortal.Api.Logging.Entities;
using RhPortal.Api.Logging.Helpers;

namespace RhPortal.Api.Logging.Filters;

public sealed class ProblemDetailsLoggingFilter : IAsyncResultFilter
{
    private readonly AppDbContext _db;
    private readonly ILogContextAccessor _accessor;
    private readonly IAuditContextAccessor _auditAccessor;

    public ProblemDetailsLoggingFilter(AppDbContext db, ILogContextAccessor accessor, IAuditContextAccessor auditAccessor)
    {
        _db = db;
        _accessor = accessor;
        _auditAccessor = auditAccessor;
    }

    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        await next();

        if (context.HttpContext.Items.ContainsKey("__exception_logged"))
            return;

        if (context.Result is not ObjectResult obj || obj.Value is not ProblemDetails problem)
            return;

        var status = problem.Status ?? context.HttpContext.Response.StatusCode;
        if (status < 400) return;

        var logContext = _accessor.Current;
        if (logContext is null) return;

        var validation = problem is ValidationProblemDetails vpd
            ? System.Text.Json.JsonSerializer.Serialize(vpd.Errors)
            : null;

        var tag = status switch
        {
            400 => "validation",
            401 or 403 => "security",
            409 => "domain",
            _ => "problem"
        };

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
            StatusCode = status,
            ExceptionType = "ProblemDetails",
            Message = MaskingAndTruncation.Truncate(problem.Title, 4096) ?? "ProblemDetails",
            ProblemTitle = MaskingAndTruncation.Truncate(problem.Title, 4096),
            ProblemDetail = MaskingAndTruncation.Truncate(problem.Detail, 4096),
            ProblemType = problem.Type,
            ValidationErrorsJson = validation,
            Tags = tag,
            CreatedAt = DateTimeOffset.UtcNow
        };

        try
        {
            using var suppress = _accessor.BeginSuppress();
            using var auditSuppress = _auditAccessor.BeginSuppress();
            _db.ExceptionLogs.Add(entry);
            await _db.SaveChangesAsync(context.HttpContext.RequestAborted);
            context.HttpContext.Items["__exception_logged"] = true;
        }
        catch
        {
            // best-effort
        }
    }
}
