using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Empresa;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Empresas (agrupador de Estabelecimentos).
/// </summary>
[ApiController]
[Route("api/empresas")]
public sealed class EmpresasController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<EmpresaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<EmpresaResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.Empresas.AsNoTracking();

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
            .Select(x => new EmpresaResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<EmpresaLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<EmpresaLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.Empresas.AsNoTracking().Where(x => x.IsActive);

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
            .Select(x => new EmpresaLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} – {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmpresaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.Empresas
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new EmpresaResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EmpresaResponse>> Create(
        [FromBody] EmpresaCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Empresas.AnyAsync(x => x.Code == code, ct))
            return Conflict(new { message = $"Empresa com o código '{code}' já existe." });

        var entity = new Empresa
        {
            Id = Guid.NewGuid(),
            Code = code,
            Description = request.Description.Trim(),
            IsActive = request.IsActive,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

        db.Empresas.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new EmpresaResponse(
            entity.Id, entity.Code, entity.Description, entity.IsActive,
            entity.CreatedAtUtc, entity.UpdatedAtUtc);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EmpresaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] EmpresaUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Empresas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Empresas.AnyAsync(x => x.Id != id && x.Code == code, ct))
            return Conflict(new { message = $"Empresa com o código '{code}' já existe." });

        entity.Code = code;
        entity.Description = request.Description.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new EmpresaResponse(
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
        var entity = await db.Empresas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        entity.IsActive = false;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
