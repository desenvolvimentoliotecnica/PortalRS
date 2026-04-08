using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Cargos;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Cargos para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/cargos")]
public sealed class CargosController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CargosController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    /// <summary>
    /// Lista cargos com paginação e filtro.
    /// </summary>
    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CargoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CargoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.Cargos.AsNoTracking();

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
            .Select(x => new CargoResponse(
                x.Id, x.Code, x.Description, x.OccupationalClassification,
                x.CargoType, x.SimilarityIndicator, x.FullDescription,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    /// <summary>
    /// Retorna lista de cargos para autocomplete/lookup.
    /// </summary>
    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CargoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CargoLookupItem>>> Lookup(
        [FromQuery] string? search,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var query = db.Cargos.AsNoTracking().Where(x => x.IsActive);

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
            .Select(x => new CargoLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Consulta um cargo pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CargoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.Cargos
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CargoResponse(
                x.Id, x.Code, x.Description, x.OccupationalClassification,
                x.CargoType, x.SimilarityIndicator, x.FullDescription,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo cargo.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CargoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CargoResponse>> Create(
        [FromBody] CargoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.Cargos.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = _localizer["ControllerErrors.CargoCodeExists", request.Code] });

        var entity = new Cargo
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            OccupationalClassification = string.IsNullOrWhiteSpace(request.OccupationalClassification) ? null : request.OccupationalClassification.Trim(),
            CargoType = string.IsNullOrWhiteSpace(request.CargoType) ? null : request.CargoType.Trim(),
            SimilarityIndicator = string.IsNullOrWhiteSpace(request.SimilarityIndicator) ? null : request.SimilarityIndicator.Trim(),
            FullDescription = string.IsNullOrWhiteSpace(request.FullDescription) ? null : request.FullDescription.Trim(),
            IsActive = request.IsActive
        };

        db.Cargos.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new CargoResponse(
            entity.Id, entity.Code, entity.Description, entity.OccupationalClassification,
            entity.CargoType, entity.SimilarityIndicator, entity.FullDescription,
            entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    /// <summary>
    /// Atualiza um cargo.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CargoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CargoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Cargos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.Cargos.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = _localizer["ControllerErrors.CargoCodeExists", request.Code] });

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.OccupationalClassification = string.IsNullOrWhiteSpace(request.OccupationalClassification) ? null : request.OccupationalClassification.Trim();
        entity.CargoType = string.IsNullOrWhiteSpace(request.CargoType) ? null : request.CargoType.Trim();
        entity.SimilarityIndicator = string.IsNullOrWhiteSpace(request.SimilarityIndicator) ? null : request.SimilarityIndicator.Trim();
        entity.FullDescription = string.IsNullOrWhiteSpace(request.FullDescription) ? null : request.FullDescription.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new CargoResponse(
            entity.Id, entity.Code, entity.Description, entity.OccupationalClassification,
            entity.CargoType, entity.SimilarityIndicator, entity.FullDescription,
            entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc));
    }

    /// <summary>
    /// Remove um cargo.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Cargos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.Cargos.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
