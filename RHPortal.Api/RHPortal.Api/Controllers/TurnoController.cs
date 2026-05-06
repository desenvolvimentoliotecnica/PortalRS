using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Turno;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Turnos para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/turnos")]
public sealed class TurnoController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public TurnoController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<TurnoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<TurnoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] Guid? unidadeLotacaoId,
        [FromQuery] bool includeGlobals = true,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 5000)
    {
        var query = db.Turnos.AsNoTracking();

        if (unidadeLotacaoId.HasValue)
        {
            query = includeGlobals
                ? query.Where(x => x.UnidadeLotacaoId == unidadeLotacaoId || x.UnidadeLotacaoId == null)
                : query.Where(x => x.UnidadeLotacaoId == unidadeLotacaoId);
        }

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
            .Select(x => new TurnoResponse(
                x.Id, x.Code, x.Description, x.StartTime, x.EndTime, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.UnidadeLotacaoId,
                x.UnidadeLotacao != null ? x.UnidadeLotacao.Description : null,
                x.GradeHorarioJson))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [ProducesResponseType(typeof(List<TurnoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<TurnoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] Guid? unidadeLotacaoId,
        [FromQuery] bool includeGlobals = true,
        // globalsOnly=true: só turnos sem UnidadeLotacaoId (requisição sem lotação informada).
        [FromQuery] bool globalsOnly = false)
    {
        var query = db.Turnos.AsNoTracking().Where(x => x.IsActive);

        if (globalsOnly)
        {
            query = query.Where(x => x.UnidadeLotacaoId == null);
        }

        if (unidadeLotacaoId.HasValue)
        {
            query = includeGlobals
                ? query.Where(x => x.UnidadeLotacaoId == unidadeLotacaoId || x.UnidadeLotacaoId == null)
                : query.Where(x => x.UnidadeLotacaoId == unidadeLotacaoId);
        }

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
            .Select(x => new TurnoLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}",
                x.UnidadeLotacaoId,
                x.StartTime,
                x.EndTime))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TurnoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TurnoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.Turnos
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new TurnoResponse(
                x.Id, x.Code, x.Description, x.StartTime, x.EndTime, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.UnidadeLotacaoId,
                x.UnidadeLotacao != null ? x.UnidadeLotacao.Description : null,
                x.GradeHorarioJson))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(TurnoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TurnoResponse>> Create(
        [FromBody] TurnoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (request.UnidadeLotacaoId.HasValue &&
            !await db.UnidadesLotacao.AnyAsync(u => u.Id == request.UnidadeLotacaoId, ct))
        {
            return BadRequest(new { message = "Unidade de lotação não encontrada." });
        }

        if (await db.Turnos.AnyAsync(x => x.Code == request.Code && x.UnidadeLotacaoId == request.UnidadeLotacaoId, ct))
            return Conflict(new { message = "Turno com este código já existe nesta unidade." });

        var entity = new Turno
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            StartTime = string.IsNullOrWhiteSpace(request.StartTime) ? null : request.StartTime.Trim(),
            EndTime = string.IsNullOrWhiteSpace(request.EndTime) ? null : request.EndTime.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            GradeHorarioJson = string.IsNullOrWhiteSpace(request.GradeHorarioJson) ? null : request.GradeHorarioJson.Trim(),
            IsActive = request.IsActive,
            UnidadeLotacaoId = request.UnidadeLotacaoId
        };

        db.Turnos.Add(entity);
        await db.SaveChangesAsync(ct);

        string? unidadeNome = null;
        if (entity.UnidadeLotacaoId.HasValue)
        {
            unidadeNome = await db.UnidadesLotacao.AsNoTracking()
                .Where(u => u.Id == entity.UnidadeLotacaoId)
                .Select(u => u.Description)
                .FirstOrDefaultAsync(ct);
        }

        var response = new TurnoResponse(
            entity.Id, entity.Code, entity.Description, entity.StartTime, entity.EndTime,
            entity.Notes, entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc,
            entity.UnidadeLotacaoId, unidadeNome, entity.GradeHorarioJson);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TurnoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TurnoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] TurnoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Turnos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (request.UnidadeLotacaoId.HasValue &&
            !await db.UnidadesLotacao.AnyAsync(u => u.Id == request.UnidadeLotacaoId, ct))
        {
            return BadRequest(new { message = "Unidade de lotação não encontrada." });
        }

        var codeExists = await db.Turnos.AnyAsync(
            x => x.Id != id && x.Code == request.Code && x.UnidadeLotacaoId == request.UnidadeLotacaoId, ct);
        if (codeExists)
            return Conflict(new { message = "Turno com este código já existe nesta unidade." });

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.StartTime = string.IsNullOrWhiteSpace(request.StartTime) ? null : request.StartTime.Trim();
        entity.EndTime = string.IsNullOrWhiteSpace(request.EndTime) ? null : request.EndTime.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.GradeHorarioJson = string.IsNullOrWhiteSpace(request.GradeHorarioJson) ? null : request.GradeHorarioJson.Trim();
        entity.IsActive = request.IsActive;
        entity.UnidadeLotacaoId = request.UnidadeLotacaoId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        string? unidadeNome = null;
        if (entity.UnidadeLotacaoId.HasValue)
        {
            unidadeNome = await db.UnidadesLotacao.AsNoTracking()
                .Where(u => u.Id == entity.UnidadeLotacaoId)
                .Select(u => u.Description)
                .FirstOrDefaultAsync(ct);
        }

        return Ok(new TurnoResponse(
            entity.Id, entity.Code, entity.Description, entity.StartTime, entity.EndTime,
            entity.Notes, entity.IsActive, entity.CreatedAtUtc, entity.UpdatedAtUtc,
            entity.UnidadeLotacaoId, unidadeNome, entity.GradeHorarioJson));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Turnos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.Turnos.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Importação em lote de turnos. Cria novos ou atualiza existentes pelo código.
    /// Suporta até 5.000 registros por requisição.
    /// </summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(TurnoImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<TurnoImportResult>> Import(
        [FromBody] List<TurnoImportItem> items,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Nenhum item fornecido." });
        if (items.Count > 5000)
            return BadRequest(new { message = "Máximo de 5.000 registros por importação." });

        var existing = await db.Turnos
            .AsNoTracking()
            .Select(x => new { x.Id, x.Code, x.UnidadeLotacaoId })
            .ToListAsync(ct);

        var existingByKey = existing.ToDictionary(
            x => $"{x.Code.ToLowerInvariant()}|{x.UnidadeLotacaoId?.ToString() ?? string.Empty}",
            x => x.Id);

        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();
        var toAdd = new List<Turno>();
        int pending = 0;

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var code = item.Code.Trim();
            var key = $"{code.ToLowerInvariant()}|{item.UnidadeLotacaoId?.ToString() ?? string.Empty}";

            if (existingByKey.TryGetValue(key, out var existingId))
            {
                var entity = await db.Turnos.FindAsync([existingId], ct);
                if (entity is null) { skipped++; continue; }
                entity.Code = code;
                entity.Description = item.Description.Trim();
                entity.StartTime = string.IsNullOrWhiteSpace(item.StartTime) ? null : item.StartTime.Trim();
                entity.EndTime = string.IsNullOrWhiteSpace(item.EndTime) ? null : item.EndTime.Trim();
                entity.Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim();
                entity.IsActive = item.IsActive;
                entity.UnidadeLotacaoId = item.UnidadeLotacaoId;
                entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                updated++;
            }
            else
            {
                var entity = new Turno
                {
                    Id = Guid.NewGuid(),
                    Code = code,
                    Description = item.Description.Trim(),
                    StartTime = string.IsNullOrWhiteSpace(item.StartTime) ? null : item.StartTime.Trim(),
                    EndTime = string.IsNullOrWhiteSpace(item.EndTime) ? null : item.EndTime.Trim(),
                    Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim(),
                    IsActive = item.IsActive,
                    UnidadeLotacaoId = item.UnidadeLotacaoId,
                };
                toAdd.Add(entity);
                existingByKey[key] = entity.Id;
                created++;
            }

            pending++;
            if (pending >= 100)
            {
                if (toAdd.Count > 0) { db.Turnos.AddRange(toAdd); toAdd.Clear(); }
                await db.SaveChangesAsync(ct);
                pending = 0;
            }
        }

        if (toAdd.Count > 0) db.Turnos.AddRange(toAdd);
        if (pending > 0) await db.SaveChangesAsync(ct);

        return Ok(new TurnoImportResult(created, updated, skipped, errors));
    }
}
