using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.NivelCargo;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Níveis de Cargo para integração TOTVS Datasul (niv_cargo).
/// </summary>
[ApiController]
[Route("api/nivel-cargo")]
public sealed class NivelCargoController : ControllerBase
{
    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<NivelCargoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<NivelCargoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 5000)
    {
        var query = db.NiveisCargo.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x =>
                x.NomReduz.ToLower().Contains(searchLower) ||
                x.NomComplet.ToLower().Contains(searchLower));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(x => x.CdnNivCargo)
            .Skip(skip)
            .Take(take)
            .Select(x => new NivelCargoResponse(
                x.Id, x.CdnNivCargo, x.NomReduz, x.NomComplet,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<NivelCargoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<NivelCargoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.NiveisCargo.AsNoTracking().Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x =>
                x.NomReduz.ToLower().Contains(searchLower) ||
                x.NomComplet.ToLower().Contains(searchLower));
        }

        var items = await query
            .OrderBy(x => x.CdnNivCargo)
            .Take(50)
            .Select(x => new NivelCargoLookupItem(
                x.Id, x.CdnNivCargo, x.NomReduz, x.NomComplet,
                $"{x.NomReduz} - {x.NomComplet}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(NivelCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NivelCargoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.NiveisCargo
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new NivelCargoResponse(
                x.Id, x.CdnNivCargo, x.NomReduz, x.NomComplet,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(NivelCargoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NivelCargoResponse>> Create(
        [FromBody] NivelCargoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.NiveisCargo.AnyAsync(x => x.CdnNivCargo == request.CdnNivCargo, ct))
            return Conflict(new { message = "Nível de cargo com este código já existe" });

        var entity = new NivelCargo
        {
            Id = Guid.NewGuid(),
            CdnNivCargo = request.CdnNivCargo,
            NomReduz = request.NomReduz.Trim(),
            NomComplet = request.NomComplet.Trim(),
            IsActive = request.IsActive,
        };

        db.NiveisCargo.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new NivelCargoResponse(
            entity.Id, entity.CdnNivCargo, entity.NomReduz, entity.NomComplet,
            entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(NivelCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NivelCargoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] NivelCargoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.NiveisCargo.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (await db.NiveisCargo.AnyAsync(x => x.Id != id && x.CdnNivCargo == request.CdnNivCargo, ct))
            return Conflict(new { message = "Nível de cargo com este código já existe" });

        entity.CdnNivCargo = request.CdnNivCargo;
        entity.NomReduz = request.NomReduz.Trim();
        entity.NomComplet = request.NomComplet.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new NivelCargoResponse(
            entity.Id, entity.CdnNivCargo, entity.NomReduz, entity.NomComplet,
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
        var entity = await db.NiveisCargo.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.NiveisCargo.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
