using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.DescricaoCargo;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Descrições de Cargo.
/// Mantém o conteúdo rico reutilizado na criação de vagas (épico Core Cadastros).
/// </summary>
[ApiController]
[Route("api/descricoes-cargo")]
public sealed class DescricaoCargoController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<DescricaoCargoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DescricaoCargoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] bool? isTemplate,
        [FromQuery] Guid? nivelCargoId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 2000)
    {
        var query = db.DescricoesCargo.AsNoTracking();

        if (isTemplate.HasValue) query = query.Where(x => x.IsTemplate == isTemplate);
        if (nivelCargoId.HasValue) query = query.Where(x => x.NivelCargoId == nivelCargoId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(s) ||
                x.Title.ToLower().Contains(s) ||
                (x.Summary != null && x.Summary.ToLower().Contains(s)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .Select(x => new DescricaoCargoResponse(
                x.Id, x.Code, x.Title, x.Summary,
                x.Responsibilities, x.Requirements, x.NiceToHave, x.Benefits,
                x.IsTemplate, x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.NivelCargoId,
                x.NivelCargo != null ? x.NivelCargo.NomComplet : null))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [ProducesResponseType(typeof(List<DescricaoCargoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DescricaoCargoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] bool? isTemplate)
    {
        var query = db.DescricoesCargo.AsNoTracking().Where(x => x.IsActive);
        if (isTemplate.HasValue) query = query.Where(x => x.IsTemplate == isTemplate);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x => x.Code.ToLower().Contains(s) || x.Title.ToLower().Contains(s));
        }

        var items = await query
            .OrderBy(x => x.Code)
            .Take(50)
            .Select(x => new DescricaoCargoLookupItem(
                x.Id, x.Code, x.Title, $"{x.Code} - {x.Title}", x.IsTemplate))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DescricaoCargoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.DescricoesCargo
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new DescricaoCargoResponse(
                x.Id, x.Code, x.Title, x.Summary,
                x.Responsibilities, x.Requirements, x.NiceToHave, x.Benefits,
                x.IsTemplate, x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.NivelCargoId,
                x.NivelCargo != null ? x.NivelCargo.NomComplet : null))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DescricaoCargoResponse>> Create(
        [FromBody] DescricaoCargoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (request.NivelCargoId.HasValue &&
            !await db.NiveisCargo.AnyAsync(n => n.Id == request.NivelCargoId, ct))
        {
            return BadRequest(new { message = "Nível de cargo não encontrado." });
        }

        var code = request.Code.Trim();
        if (await db.DescricoesCargo.AnyAsync(x => x.Code == code, ct))
            return Conflict(new { message = $"Já existe uma descrição com o código '{code}'." });

        var entity = new DescricaoCargo
        {
            Id = Guid.NewGuid(),
            Code = code,
            Title = request.Title.Trim(),
            Summary = NullIfBlank(request.Summary),
            Responsibilities = NullIfBlank(request.Responsibilities),
            Requirements = NullIfBlank(request.Requirements),
            NiceToHave = NullIfBlank(request.NiceToHave),
            Benefits = NullIfBlank(request.Benefits),
            IsTemplate = request.IsTemplate,
            IsActive = request.IsActive,
            NivelCargoId = request.NivelCargoId,
        };

        db.DescricoesCargo.Add(entity);
        await db.SaveChangesAsync(ct);

        var created = await LoadResponse(db, entity.Id, ct);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DescricaoCargoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] DescricaoCargoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.DescricoesCargo.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (request.NivelCargoId.HasValue &&
            !await db.NiveisCargo.AnyAsync(n => n.Id == request.NivelCargoId, ct))
        {
            return BadRequest(new { message = "Nível de cargo não encontrado." });
        }

        var code = request.Code.Trim();
        if (await db.DescricoesCargo.AnyAsync(x => x.Id != id && x.Code == code, ct))
            return Conflict(new { message = $"Já existe outra descrição com o código '{code}'." });

        entity.Code = code;
        entity.Title = request.Title.Trim();
        entity.Summary = NullIfBlank(request.Summary);
        entity.Responsibilities = NullIfBlank(request.Responsibilities);
        entity.Requirements = NullIfBlank(request.Requirements);
        entity.NiceToHave = NullIfBlank(request.NiceToHave);
        entity.Benefits = NullIfBlank(request.Benefits);
        entity.IsTemplate = request.IsTemplate;
        entity.IsActive = request.IsActive;
        entity.NivelCargoId = request.NivelCargoId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        var updated = await LoadResponse(db, id, ct);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.DescricoesCargo.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.DescricoesCargo.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static async Task<DescricaoCargoResponse> LoadResponse(AppDbContext db, Guid id, CancellationToken ct)
    {
        return await db.DescricoesCargo
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new DescricaoCargoResponse(
                x.Id, x.Code, x.Title, x.Summary,
                x.Responsibilities, x.Requirements, x.NiceToHave, x.Benefits,
                x.IsTemplate, x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.NivelCargoId,
                x.NivelCargo != null ? x.NivelCargo.NomComplet : null))
            .FirstAsync(ct);
    }

    private static string? NullIfBlank(string? s)
        => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
