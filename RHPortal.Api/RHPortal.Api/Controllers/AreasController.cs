using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Areas;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/areas")]
public sealed class AreasController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public AreasController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    public async Task<ActionResult<List<AreaResponse>>> List([FromServices] AppDbContext db, CancellationToken ct)
    {
        var items = await db.Areas
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new AreaResponse(x.Id, x.Code, x.Name, x.Description, x.IsActive))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AreaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.Areas
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AreaResponse(x.Id, x.Code, x.Name, x.Description, x.IsActive))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<AreaResponse>> Create(
        [FromBody] AreaCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.Areas.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = _localizer["ControllerErrors.AreaCodeExists", request.Code] });

        var entity = new Domain.Entities.Area
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = request.IsActive
        };

        db.Areas.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new AreaResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.IsActive);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AreaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] AreaUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Areas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.Areas.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = _localizer["ControllerErrors.AreaCodeExists", request.Code] });

        entity.Code = request.Code.Trim();
        entity.Name = request.Name.Trim();
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.IsActive = request.IsActive;

        await db.SaveChangesAsync(ct);

        return Ok(new AreaResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.IsActive));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Areas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var hasDeps = await db.Departments.AnyAsync(x => x.AreaId == id, ct)
            || await db.JobPositions.AnyAsync(x => x.AreaId == id, ct)
            || await db.Managers.AnyAsync(x => x.AreaId == id, ct)
            || await db.Vagas.AnyAsync(x => x.AreaId == id, ct);

        if (hasDeps)
            return Conflict(new { message = _localizer["ControllerErrors.AreaHasDependencies"] });

        db.Areas.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
