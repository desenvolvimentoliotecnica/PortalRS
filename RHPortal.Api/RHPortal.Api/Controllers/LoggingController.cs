using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Logging;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/logs")]
public sealed class LoggingController : ControllerBase
{
    [RequirePermission("logs.view")]
    [HttpGet("requests")]
    public async Task<ActionResult<RequestLogListResponse>> List(
        [FromServices] AppDbContext db,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] string? search = null,
        [FromQuery] string? level = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 200);

        var query = db.RequestLogs.AsNoTracking();

        // Avoid showing in-flight requests that haven't been finalized yet.
        query = query.Where(x => x.EndedAt != null);

        if (from.HasValue)
            query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(x => x.StartedAt <= to.Value);

        var searchText = (search ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(searchText))
        {
            query = query.Where(x =>
                x.TransactionId.Contains(searchText) ||
                (x.Path != null && x.Path.Contains(searchText)) ||
                (x.UserName != null && x.UserName.Contains(searchText)) ||
                (x.Method != null && x.Method.Contains(searchText)));
        }

        var levelFilter = (level ?? string.Empty).Trim().ToLowerInvariant();
        if (levelFilter is "error" or "warning")
        {
            query = levelFilter == "error"
                ? query.Where(x => x.ErrorCount > 0)
                : query.Where(x => x.WarningCount > 0);
        }

        var totalItems = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .OrderByDescending(x => x.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new RequestLogListItem(
                x.Id,
                x.TransactionId,
                x.StartedAt,
                x.DurationMs,
                x.Method,
                x.Path,
                x.StatusCode,
                x.IsSuccess,
                x.UserName,
                x.EnvironmentNormalized,
                x.DeviceType ?? "unknown"
            ))
            .ToListAsync(ct);

        return Ok(new RequestLogListResponse(items, page, pageSize, totalItems, totalPages));
    }

    [RequirePermission("logs.view")]
    [HttpGet("requests/{id:guid}")]
    public async Task<ActionResult<RequestLogDetailResponse>> GetById(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var log = await db.RequestLogs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (log is null)
            return NotFound();

        var entries = await db.LogEntries.AsNoTracking()
            .Where(x => x.RequestLogId == id)
            .OrderBy(x => x.Order)
            .Select(x => new LogEntryItem(
                x.Id,
                x.Order,
                x.Level,
                x.Category,
                x.EventId,
                x.EventName,
                x.Message,
                x.OccurredAt
            ))
            .ToListAsync(ct);

        var exceptions = await db.ExceptionLogs.AsNoTracking()
            .Where(x => x.RequestLogId == id)
            .OrderBy(x => x.Order)
            .Select(x => new ExceptionLogItem(
                x.Id,
                x.Order,
                x.IsHandled,
                x.StatusCode,
                x.ExceptionType,
                x.Message,
                x.Tags,
                x.OccurredAt
            ))
            .ToListAsync(ct);

        return Ok(new RequestLogDetailResponse(
            log.Id,
            log.TransactionId,
            log.CorrelationId,
            log.TraceId,
            log.EnvironmentName,
            log.EnvironmentNormalized,
            log.DeviceId,
            log.DeviceType,
            log.Platform,
            log.Browser,
            log.DeviceAppVersion,
            log.Locale,
            log.StartedAt,
            log.EndedAt,
            log.DurationMs,
            log.Method,
            log.Path,
            log.QueryString,
            log.StatusCode,
            log.IsSuccess,
            log.UserId,
            log.UserName,
            log.ClientId,
            log.Ip,
            log.UserAgent,
            log.Host,
            log.Controller,
            log.Action,
            log.RouteTemplate,
            log.ErrorCount,
            log.WarningCount,
            entries,
            exceptions
        ));
    }
}
