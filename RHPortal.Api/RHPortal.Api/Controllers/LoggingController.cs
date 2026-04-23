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

    [RequirePermission("logs.view")]
    [HttpGet("summary")]
    public async Task<ActionResult<RequestLogSummaryResponse>> Summary(
        [FromServices] AppDbContext db,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int top = 6,
        CancellationToken ct = default)
    {
        top = Math.Clamp(top, 3, 12);
        var query = db.RequestLogs.AsNoTracking().Where(x => x.EndedAt != null);

        if (from.HasValue)
            query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(x => x.StartedAt <= to.Value);

        var topRoutes = await query
            .GroupBy(x => x.Path)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new RequestLogSummaryItem(
                g.Key,
                g.Count(),
                (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var topUsers = await query
            .Where(x => x.UserName != null && x.UserName != "")
            .GroupBy(x => x.UserName!)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new RequestLogSummaryItem(
                g.Key,
                g.Count(),
                (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var statuses = await query
            .GroupBy(x => x.StatusCode ?? 0)
            .OrderByDescending(g => g.Count())
            .Select(g => new RequestLogStatusItem(g.Key, g.Count()))
            .ToListAsync(ct);

        return Ok(new RequestLogSummaryResponse(topRoutes, topUsers, statuses));
    }

    /// <summary>
    /// Lista flat de log entries (logs operacionais do tenant) — usado pela tela
    /// /app/admin/operational-logs. Suporta busca em Message/Category e filtro por Level.
    /// </summary>
    [RequirePermission("logs.view")]
    [HttpGet("entries")]
    public async Task<ActionResult<OperationalLogListResponse>> ListEntries(
        [FromServices] AppDbContext db,
        [FromQuery] string? q = null,
        [FromQuery] string? level = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 200);

        var query = db.LogEntries.AsNoTracking();

        var levelFilter = (level ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(levelFilter))
            query = query.Where(x => x.Level.ToLower() == levelFilter.ToLower());

        var searchText = (q ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(searchText))
        {
            query = query.Where(x =>
                x.Message.Contains(searchText) ||
                x.Category.Contains(searchText) ||
                (x.ExceptionMessage != null && x.ExceptionMessage.Contains(searchText)) ||
                (x.ExceptionType != null && x.ExceptionType.Contains(searchText)));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(x => x.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new OperationalLogItem(
                x.Id,
                x.Level,
                x.Message,
                x.Category,
                x.OccurredAt,
                x.ExceptionType != null
                    ? (x.ExceptionType + (x.ExceptionMessage != null ? ": " + x.ExceptionMessage : string.Empty)
                        + (x.ExceptionStackTrace != null ? "\n" + x.ExceptionStackTrace : string.Empty))
                    : null
            ))
            .ToListAsync(ct);

        return Ok(new OperationalLogListResponse(items, totalCount));
    }
}
