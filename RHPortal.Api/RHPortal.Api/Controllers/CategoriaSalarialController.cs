using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.CategoriaSalarial;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Categorias Salariais para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/categorias-salariais")]
public sealed class CategoriaSalarialController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CategoriaSalarialController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CategoriaSalarialResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CategoriaSalarialResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.CategoriasSalariais.AsNoTracking();

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
            .Select(x => new CategoriaSalarialResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CategoriaSalarialLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CategoriaSalarialLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.CategoriasSalariais.AsNoTracking().Where(x => x.IsActive);

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
            .Select(x => new CategoriaSalarialLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoriaSalarialResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.CategoriasSalariais
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CategoriaSalarialResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoriaSalarialResponse>> Create(
        [FromBody] CategoriaSalarialCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.CategoriasSalariais.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = "Categoria com este código já existe" });

        var entity = new CategoriaSalarial
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            IsActive = request.IsActive
        };

        db.CategoriasSalariais.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new CategoriaSalarialResponse(
            entity.Id, entity.Code, entity.Description, entity.IsActive,
            entity.CreatedAtUtc, entity.UpdatedAtUtc);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoriaSalarialResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CategoriaSalarialUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CategoriasSalariais.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.CategoriasSalariais.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = "Categoria com este código já existe" });

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new CategoriaSalarialResponse(
            entity.Id, entity.Code, entity.Description, entity.IsActive,
            entity.CreatedAtUtc, entity.UpdatedAtUtc));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CategoriasSalariais.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.CategoriasSalariais.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
