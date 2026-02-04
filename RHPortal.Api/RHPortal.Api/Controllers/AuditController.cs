using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Auditing;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Auditoria: consultas de transações e trilhas de alteração.
/// </summary>
[ApiController]
[Route("api/audit")]
public sealed class AuditController : ControllerBase
{
    /// <summary>
    /// Lista transações de auditoria com filtros e paginação.
    /// </summary>
    [RequirePermission("audit.view")]
    [HttpGet("transactions")]
    [ProducesResponseType(typeof(AuditTransactionListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuditTransactionListResponse>> List(
        [FromServices] AppDbContext db,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? methods = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 200);

        var query = db.AuditTransactions.AsNoTracking()
            .Where(x => x.Method != null && x.Method != "" && x.Path != null && x.Path != "");

        if (from.HasValue)
            query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(x => x.StartedAt <= to.Value);

        var statusFilter = (status ?? string.Empty).Trim().ToLowerInvariant();
        if (statusFilter == "success")
            query = query.Where(x => x.IsSuccess);
        else if (statusFilter == "error")
            query = query.Where(x => !x.IsSuccess);

        var searchText = (search ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(searchText))
        {
            query = query.Where(x =>
                x.TransactionId.Contains(searchText) ||
                (x.Path != null && x.Path.Contains(searchText)) ||
                (x.UserName != null && x.UserName.Contains(searchText)) ||
                (x.Method != null && x.Method.Contains(searchText)));
        }

        var methodsFilter = (methods ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.ToUpperInvariant())
            .ToArray();
        if (methodsFilter.Length > 0)
        {
            query = query.Where(x => x.Method != null && methodsFilter.Contains(x.Method.ToUpper()));
        }

        var totalItems = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .OrderByDescending(x => x.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditTransactionListItem(
                x.Id,
                x.TransactionId,
                x.CorrelationId,
                x.StartedAt,
                x.DurationMs,
                x.UserName,
                x.Method,
                x.Path,
                x.StatusCode,
                x.IsSuccess
            ))
            .ToListAsync(ct);

        return Ok(new AuditTransactionListResponse(items, page, pageSize, totalItems, totalPages));
    }

    /// <summary>
    /// Detalha uma transação de auditoria com eventos e mudanças.
    /// </summary>
    [RequirePermission("audit.view")]
    [HttpGet("transactions/{id:guid}")]
    [ProducesResponseType(typeof(AuditTransactionDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuditTransactionDetailResponse>> GetById(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var transaction = await db.AuditTransactions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (transaction is null)
            return NotFound();

        var events = await db.AuditEvents.AsNoTracking()
            .Where(x => x.AuditTransactionId == id)
            .OrderBy(x => x.Order)
            .Select(x => new AuditEventItem(
                x.Id,
                x.Order,
                x.EventType,
                x.Name,
                x.OccurredAt,
                x.DataJson
            ))
            .ToListAsync(ct);

        var changes = await db.AuditEntityChanges.AsNoTracking()
            .Where(x => x.AuditTransactionId == id)
            .OrderBy(x => x.Order)
            .ThenBy(x => x.EntityName)
            .Select(x => new AuditEntityChangeItem(
                x.Id,
                x.Order,
                x.EntityName,
                x.TableName,
                x.State,
                x.PrimaryKeyJson,
                x.BeforeJson,
                x.AfterJson,
                x.ChangedColumns,
                x.DataJson,
                x.OccurredAt
            ))
            .ToListAsync(ct);

        var changeIds = changes.Select(x => x.Id).ToArray();
        var properties = changeIds.Length == 0
            ? new List<AuditPropertyChangeItem>()
            : await db.AuditEntityPropertyChanges.AsNoTracking()
                .Where(x => changeIds.Contains(x.AuditEntityChangeId))
                .Select(x => new AuditPropertyChangeItem(
                    x.Id,
                    x.PropertyName,
                    x.BeforeValue,
                    x.AfterValue,
                    x.IsSensitive
                ))
                .ToListAsync(ct);

        return Ok(new AuditTransactionDetailResponse(
            transaction.Id,
            transaction.TransactionId,
            transaction.CorrelationId,
            transaction.TraceId,
            transaction.SpanId,
            transaction.ParentSpanId,
            transaction.Environment,
            transaction.AppVersion,
            transaction.StartedAt,
            transaction.EndedAt,
            transaction.DurationMs,
            transaction.UserId,
            transaction.UserName,
            transaction.ClientId,
            transaction.Ip,
            transaction.UserAgent,
            transaction.Host,
            transaction.Method,
            transaction.Path,
            transaction.QueryString,
            transaction.RouteTemplate,
            transaction.Controller,
            transaction.Action,
            transaction.StatusCode,
            transaction.IsSuccess,
            transaction.RequestContentType,
            transaction.ResponseContentType,
            transaction.RequestBody,
            transaction.ResponseBody,
            transaction.RequestBodyHash,
            transaction.ResponseBodyHash,
            transaction.RequestIsTruncated,
            transaction.ResponseIsTruncated,
            transaction.RequestTruncatedBytes,
            transaction.ResponseTruncatedBytes,
            transaction.ErrorMessage,
            transaction.ErrorStackTrace,
            events,
            changes,
            properties
        ));
    }

    /// <summary>
    /// Resumo de auditoria: rotas, usuários e status mais frequentes.
    /// </summary>
    [RequirePermission("audit.view")]
    [HttpGet("summary")]
    [ProducesResponseType(typeof(AuditSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuditSummaryResponse>> Summary(
        [FromServices] AppDbContext db,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int top = 6,
        CancellationToken ct = default)
    {
        top = Math.Clamp(top, 3, 12);
        var query = db.AuditTransactions.AsNoTracking();

        if (from.HasValue)
            query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(x => x.StartedAt <= to.Value);

        var topRoutes = await query
            .GroupBy(x => x.Path)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new AuditSummaryItem(
                g.Key,
                g.Count(),
                (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var topUsers = await query
            .Where(x => x.UserName != null && x.UserName != "")
            .GroupBy(x => x.UserName!)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new AuditSummaryItem(
                g.Key,
                g.Count(),
                (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var statuses = await query
            .GroupBy(x => x.StatusCode ?? 0)
            .OrderByDescending(g => g.Count())
            .Select(g => new AuditStatusItem(g.Key, g.Count()))
            .ToListAsync(ct);

        return Ok(new AuditSummaryResponse(topRoutes, topUsers, statuses));
    }

    /// <summary>
    /// Lista alterações de auditoria para uma entidade (por nome e ID).
    /// </summary>
    [RequirePermission("audit.view")]
    [HttpGet("entity-changes")]
    [ProducesResponseType(typeof(EntityChangesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<EntityChangesResponse>> GetEntityChanges(
        [FromServices] AppDbContext db,
        [FromQuery] string? entityName = null,
        [FromQuery] Guid? entityId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(entityName) || !entityId.HasValue)
            return BadRequest("entityName and entityId are required.");

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var idStr = entityId.Value.ToString();

        var query = from c in db.AuditEntityChanges.AsNoTracking()
                    join t in db.AuditTransactions.AsNoTracking() on c.AuditTransactionId equals t.Id
                    where c.EntityName == entityName.Trim() && c.PrimaryKeyJson != null && c.PrimaryKeyJson.Contains(idStr)
                    select new { c, t.UserName };

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.c.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EntityChangeListItem(
                x.c.Id,
                x.c.OccurredAt,
                x.c.State,
                x.c.EntityName,
                x.UserName,
                x.c.ChangedColumns
            ))
            .ToListAsync(ct);

        return Ok(new EntityChangesResponse(items, totalCount, page, pageSize));
    }
}
