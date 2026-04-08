using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.UnidadeLotacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Unidades de Lotação para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/unidades-lotacao")]
public sealed class UnidadeLotacaoController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public UnidadeLotacaoController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<UnidadeLotacaoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<UnidadeLotacaoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.UnidadesLotacao.AsNoTracking();

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
            .Select(x => new UnidadeLotacaoResponse(
                x.Id, x.Code, x.Description, x.Location, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<UnidadeLotacaoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<UnidadeLotacaoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.UnidadesLotacao.AsNoTracking().Where(x => x.IsActive);

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
            .Select(x => new UnidadeLotacaoLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(UnidadeLotacaoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UnidadeLotacaoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.UnidadesLotacao
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new UnidadeLotacaoResponse(
                x.Id, x.Code, x.Description, x.Location, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(UnidadeLotacaoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UnidadeLotacaoResponse>> Create(
        [FromBody] UnidadeLotacaoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.UnidadesLotacao.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = "Unidade de Lotação com este código já existe" });

        var entity = new UnidadeLotacao
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim(),
            Manager = string.IsNullOrWhiteSpace(request.Manager) ? null : request.Manager.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            IsActive = request.IsActive
        };

        db.UnidadesLotacao.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new UnidadeLotacaoResponse(
            entity.Id, entity.Code, entity.Description, entity.Location, entity.Manager, entity.Notes,
            entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(UnidadeLotacaoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UnidadeLotacaoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] UnidadeLotacaoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.UnidadesLotacao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.UnidadesLotacao.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = "Unidade de Lotação com este código já existe" });

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim();
        entity.Manager = string.IsNullOrWhiteSpace(request.Manager) ? null : request.Manager.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new UnidadeLotacaoResponse(
            entity.Id, entity.Code, entity.Description, entity.Location, entity.Manager, entity.Notes,
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
        var entity = await db.UnidadesLotacao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.UnidadesLotacao.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
