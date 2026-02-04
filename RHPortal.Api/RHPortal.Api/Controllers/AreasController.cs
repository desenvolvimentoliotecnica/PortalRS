using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Areas;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de áreas (hierarquia organizacional com dono por nó).
/// </summary>
[ApiController]
[Route("api/areas")]
public sealed class AreasController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public AreasController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    /// <summary>
    /// Lista áreas. Sem parentId retorna todas (flat). Com parentId retorna apenas as filhas diretas dessa área.
    /// </summary>
    /// <param name="parentId">Opcional. Se informado, retorna apenas as áreas cujo ParentId é este valor.</param>
    [HttpGet]
    [ProducesResponseType(typeof(List<AreaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<AreaResponse>>> List(
        [FromQuery] Guid? parentId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var query = db.Areas.AsNoTracking();

        if (parentId.HasValue && parentId.Value != Guid.Empty)
            query = query.Where(x => x.ParentId == parentId.Value);

        var items = await query
            .OrderBy(x => x.Name)
            .Select(x => new AreaResponse(x.Id, x.Code, x.Name, x.Description, x.IsActive, x.ParentId, x.OwnerFuncionarioId))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Consulta uma área pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AreaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AreaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.Areas
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AreaResponse(x.Id, x.Code, x.Name, x.Description, x.IsActive, x.ParentId, x.OwnerFuncionarioId))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria uma nova área.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(AreaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AreaResponse>> Create(
        [FromBody] AreaCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.Areas.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = _localizer["ControllerErrors.AreaCodeExists", request.Code] });

        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            var parentExists = await db.Areas.AnyAsync(x => x.Id == request.ParentId.Value, ct);
            if (!parentExists)
                return Conflict(new { message = _localizer["ControllerErrors.AreaParentNotFound"] });
        }

        if (request.OwnerFuncionarioId.HasValue && request.OwnerFuncionarioId.Value != Guid.Empty)
        {
            var funcionarioExists = await db.Funcionarios.AnyAsync(x => x.Id == request.OwnerFuncionarioId.Value, ct);
            if (!funcionarioExists)
                return Conflict(new { message = _localizer["ControllerErrors.AreaOwnerFuncionarioNotFound"] });
        }

        var entity = new Domain.Entities.Area
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = request.IsActive,
            ParentId = request.ParentId,
            OwnerFuncionarioId = request.OwnerFuncionarioId
        };

        db.Areas.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new AreaResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.IsActive, entity.ParentId, entity.OwnerFuncionarioId);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    /// <summary>
    /// Atualiza uma área. Não permite ciclo na hierarquia (ParentId não pode ser self nem descendente).
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AreaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
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

        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            if (request.ParentId.Value == id)
                return Conflict(new { message = _localizer["ControllerErrors.AreaCycleSelf"] });

            var descendantIds = await GetDescendantAreaIdsAsync(db, id, ct);
            if (descendantIds.Contains(request.ParentId.Value))
                return Conflict(new { message = _localizer["ControllerErrors.AreaCycleDescendant"] });

            var parentExists = await db.Areas.AnyAsync(x => x.Id == request.ParentId.Value, ct);
            if (!parentExists)
                return Conflict(new { message = _localizer["ControllerErrors.AreaParentNotFound"] });
        }

        if (request.OwnerFuncionarioId.HasValue && request.OwnerFuncionarioId.Value != Guid.Empty)
        {
            var funcionarioExists = await db.Funcionarios.AnyAsync(x => x.Id == request.OwnerFuncionarioId.Value, ct);
            if (!funcionarioExists)
                return Conflict(new { message = _localizer["ControllerErrors.AreaOwnerFuncionarioNotFound"] });
        }

        entity.Code = request.Code.Trim();
        entity.Name = request.Name.Trim();
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.IsActive = request.IsActive;
        entity.ParentId = request.ParentId;
        entity.OwnerFuncionarioId = request.OwnerFuncionarioId;

        await db.SaveChangesAsync(ct);

        return Ok(new AreaResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.IsActive, entity.ParentId, entity.OwnerFuncionarioId));
    }

    /// <summary>
    /// Remove uma área (se não houver dependências, incluindo filhos).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Areas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var hasChildren = await db.Areas.AnyAsync(x => x.ParentId == id, ct);
        if (hasChildren)
            return Conflict(new { message = _localizer["ControllerErrors.AreaHasChildren"] });

        var hasDeps = await db.Departments.AnyAsync(x => x.AreaId == id, ct)
            || await db.JobPositions.AnyAsync(x => x.AreaId == id, ct)
            || await db.Funcionarios.AnyAsync(x => x.AreaId == id, ct)
            || await db.Vagas.AnyAsync(x => x.AreaId == id, ct);

        if (hasDeps)
            return Conflict(new { message = _localizer["ControllerErrors.AreaHasDependencies"] });

        db.Areas.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    private static async Task<HashSet<Guid>> GetDescendantAreaIdsAsync(AppDbContext db, Guid areaId, CancellationToken ct)
    {
        var result = new HashSet<Guid>();
        var current = new List<Guid> { areaId };

        while (current.Count > 0)
        {
            var children = await db.Areas
                .AsNoTracking()
                .Where(x => x.ParentId != null && current.Contains(x.ParentId.Value))
                .Select(x => x.Id)
                .ToListAsync(ct);

            foreach (var c in children)
                result.Add(c);

            current = children;
        }

        return result;
    }
}
