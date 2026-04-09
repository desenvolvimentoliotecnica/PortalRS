using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.CentroCusto;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Centros de Custo para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/centros-custo")]
public sealed class CentroCustoController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CentroCustoController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CentroCustoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CentroCustoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.CentrosCusto.AsNoTracking();

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
            .Select(x => new CentroCustoResponse(
                x.Id, x.Code, x.Description, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CentroCustoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CentroCustoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.CentrosCusto.AsNoTracking().Where(x => x.IsActive);

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
            .Select(x => new CentroCustoLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CentroCustoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CentroCustoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.CentrosCusto
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CentroCustoResponse(
                x.Id, x.Code, x.Description, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CentroCustoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CentroCustoResponse>> Create(
        [FromBody] CentroCustoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.CentrosCusto.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = "Centro de Custo com este código já existe" });

        var entity = new CentroCusto
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            Manager = string.IsNullOrWhiteSpace(request.Manager) ? null : request.Manager.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            IsActive = request.IsActive
        };

        db.CentrosCusto.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new CentroCustoResponse(
            entity.Id, entity.Code, entity.Description, entity.Manager, entity.Notes,
            entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CentroCustoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CentroCustoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CentroCustoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CentrosCusto.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.CentrosCusto.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = "Centro de Custo com este código já existe" });

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.Manager = string.IsNullOrWhiteSpace(request.Manager) ? null : request.Manager.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new CentroCustoResponse(
            entity.Id, entity.Code, entity.Description, entity.Manager, entity.Notes,
            entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CentrosCusto.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.CentrosCusto.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
