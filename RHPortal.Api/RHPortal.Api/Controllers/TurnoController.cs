using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Turno;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Turnos para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/turnos")]
public sealed class TurnoController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public TurnoController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<TurnoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<TurnoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.Turnos.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(searchLower) ||
                x.Description.ToLower().Contains(searchLower));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .Select(x => new TurnoResponse(
                x.Id, x.Code, x.Description, x.StartTime, x.EndTime, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<TurnoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<TurnoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.Turnos.AsNoTracking().Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(searchLower) ||
                x.Description.ToLower().Contains(searchLower));
        }

        var items = await query
            .OrderBy(x => x.Code)
            .Take(50)
            .Select(x => new TurnoLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TurnoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TurnoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.Turnos
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new TurnoResponse(
                x.Id, x.Code, x.Description, x.StartTime, x.EndTime, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(TurnoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TurnoResponse>> Create(
        [FromBody] TurnoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.Turnos.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = "Turno com este código já existe" });

        var entity = new Turno
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            StartTime = string.IsNullOrWhiteSpace(request.StartTime) ? null : request.StartTime.Trim(),
            EndTime = string.IsNullOrWhiteSpace(request.EndTime) ? null : request.EndTime.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            IsActive = request.IsActive
        };

        db.Turnos.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new TurnoResponse(
            entity.Id, entity.Code, entity.Description, entity.StartTime, entity.EndTime,
            entity.Notes, entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TurnoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TurnoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] TurnoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Turnos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.Turnos.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = "Turno com este código já existe" });

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.StartTime = string.IsNullOrWhiteSpace(request.StartTime) ? null : request.StartTime.Trim();
        entity.EndTime = string.IsNullOrWhiteSpace(request.EndTime) ? null : request.EndTime.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new TurnoResponse(
            entity.Id, entity.Code, entity.Description, entity.StartTime, entity.EndTime,
            entity.Notes, entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Turnos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.Turnos.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
