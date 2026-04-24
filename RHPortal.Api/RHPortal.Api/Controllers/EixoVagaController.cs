using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.EixoVaga;
using RhPortal.Api.Infrastructure.Data;
using EixoVagaEntity = RhPortal.Api.Domain.Entities.EixoVaga;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Eixos de Vaga. Admin configura SLA de fechamento por eixo;
/// vagas apontam para um eixo e usam esse SLA como override do SLA global.
/// </summary>
[ApiController]
[Route("api/eixos-vaga")]
public sealed class EixoVagaController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<EixoVagaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<EixoVagaResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 2000)
    {
        var query = db.EixosVaga.AsNoTracking();

        if (isActive.HasValue) query = query.Where(x => x.IsActive == isActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(s) ||
                x.Name.ToLower().Contains(s) ||
                (x.Description != null && x.Description.ToLower().Contains(s)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .Select(x => new EixoVagaResponse(
                x.Id, x.Code, x.Name, x.Description,
                x.SlaDiasMetaFechamento, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [ProducesResponseType(typeof(List<EixoVagaLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<EixoVagaLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.EixosVaga.AsNoTracking().Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x => x.Code.ToLower().Contains(s) || x.Name.ToLower().Contains(s));
        }

        var items = await query
            .OrderBy(x => x.Code)
            .Take(50)
            .Select(x => new EixoVagaLookupItem(
                x.Id, x.Code, x.Name,
                $"{x.Code} - {x.Name}",
                x.SlaDiasMetaFechamento))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EixoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EixoVagaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.EixosVaga
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new EixoVagaResponse(
                x.Id, x.Code, x.Name, x.Description,
                x.SlaDiasMetaFechamento, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(EixoVagaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EixoVagaResponse>> Create(
        [FromBody] EixoVagaCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var code = request.Code.Trim();
        if (await db.EixosVaga.AnyAsync(x => x.Code == code, ct))
            return Conflict(new { message = $"Já existe um eixo com o código '{code}'." });

        if (request.SlaDiasMetaFechamento is int sla && sla <= 0)
            return BadRequest(new { message = "SLA deve ser um número positivo de dias." });

        var now = DateTimeOffset.UtcNow;
        var entity = new EixoVagaEntity
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = NullIfBlank(request.Description),
            SlaDiasMetaFechamento = request.SlaDiasMetaFechamento,
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        db.EixosVaga.Add(entity);
        await db.SaveChangesAsync(ct);

        var created = new EixoVagaResponse(
            entity.Id, entity.Code, entity.Name, entity.Description,
            entity.SlaDiasMetaFechamento, entity.IsActive,
            entity.CreatedAtUtc, entity.UpdatedAtUtc);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EixoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EixoVagaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] EixoVagaUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.EixosVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var code = request.Code.Trim();
        if (await db.EixosVaga.AnyAsync(x => x.Id != id && x.Code == code, ct))
            return Conflict(new { message = $"Já existe outro eixo com o código '{code}'." });

        if (request.SlaDiasMetaFechamento is int sla && sla <= 0)
            return BadRequest(new { message = "SLA deve ser um número positivo de dias." });

        entity.Code = code;
        entity.Name = request.Name.Trim();
        entity.Description = NullIfBlank(request.Description);
        entity.SlaDiasMetaFechamento = request.SlaDiasMetaFechamento;
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new EixoVagaResponse(
            entity.Id, entity.Code, entity.Name, entity.Description,
            entity.SlaDiasMetaFechamento, entity.IsActive,
            entity.CreatedAtUtc, entity.UpdatedAtUtc));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.EixosVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var inUse = await db.Vagas.AnyAsync(v => v.EixoVagaId == id, ct);
        if (inUse)
            return Conflict(new { message = "Eixo em uso por uma ou mais vagas. Desative em vez de excluir." });

        db.EixosVaga.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static string? NullIfBlank(string? s)
        => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
