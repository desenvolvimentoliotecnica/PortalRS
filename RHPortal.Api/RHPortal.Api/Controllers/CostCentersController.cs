using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.CostCenters;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/cost-centers")]
public sealed class CostCentersController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CostCentersController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    public async Task<ActionResult<List<CostCenterResponse>>> List([FromServices] AppDbContext db, CancellationToken ct)
    {
        var items = await db.CostCenters
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new CostCenterResponse(x.Id, x.Code, x.Name, x.Description, x.GroupName, x.UnitName, x.IsActive))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CostCenterResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.CostCenters
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CostCenterResponse(x.Id, x.Code, x.Name, x.Description, x.GroupName, x.UnitName, x.IsActive))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<CostCenterResponse>> Create(
        [FromBody] CostCenterCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.CostCenters.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = _localizer["ControllerErrors.CostCenterCodeExists", request.Code] });

        var entity = new Domain.Entities.CostCenter
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            GroupName = string.IsNullOrWhiteSpace(request.GroupName) ? null : request.GroupName.Trim(),
            UnitName = string.IsNullOrWhiteSpace(request.UnitName) ? null : request.UnitName.Trim(),
            IsActive = request.IsActive
        };

        db.CostCenters.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new CostCenterResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.GroupName, entity.UnitName, entity.IsActive);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CostCenterResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CostCenterUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CostCenters.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.CostCenters.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = _localizer["ControllerErrors.CostCenterCodeExists", request.Code] });

        entity.Code = request.Code.Trim();
        entity.Name = request.Name.Trim();
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.GroupName = string.IsNullOrWhiteSpace(request.GroupName) ? null : request.GroupName.Trim();
        entity.UnitName = string.IsNullOrWhiteSpace(request.UnitName) ? null : request.UnitName.Trim();
        entity.IsActive = request.IsActive;

        await db.SaveChangesAsync(ct);

        return Ok(new CostCenterResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.GroupName, entity.UnitName, entity.IsActive));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CostCenters.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var code = (entity.Code ?? string.Empty).Trim().ToLowerInvariant();
        var name = (entity.Name ?? string.Empty).Trim().ToLowerInvariant();

        var hasDeps = await db.Departments.AnyAsync(x =>
            x.CostCenter != null &&
            (x.CostCenter.ToLower() == code || x.CostCenter.ToLower() == name), ct);

        if (hasDeps)
            return Conflict(new { message = _localizer["ControllerErrors.CostCenterHasDepartments"] });

        db.CostCenters.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
