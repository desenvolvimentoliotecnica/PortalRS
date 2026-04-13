using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.CategoriaSalarial;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Categorias Salariais para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/categorias-salariais")]
public sealed class CategoriaSalarialController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CategoriaSalarialController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<CategoriaSalarialResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CategoriaSalarialResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 5000)
    {
        var query = db.CategoriasSalariais.AsNoTracking();

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
            .Select(x => new CategoriaSalarialResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId, x.EstabelecimentoId,
                x.Empresa != null ? x.Empresa.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Name : null))
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CategoriaSalarialLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CategoriaSalarialLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.CategoriasSalariais.AsNoTracking().Where(x => x.IsActive);

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
            .Select(x => new CategoriaSalarialLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoriaSalarialResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.CategoriasSalariais
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CategoriaSalarialResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId, x.EstabelecimentoId,
                x.Empresa != null ? x.Empresa.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Name : null))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoriaSalarialResponse>> Create(
        [FromBody] CategoriaSalarialCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.CategoriasSalariais.AnyAsync(
            x => x.EmpresaId == request.EmpresaId &&
                 x.EstabelecimentoId == request.EstabelecimentoId &&
                 x.Code == request.Code.Trim(), ct))
            return Conflict(new { message = "Já existe uma categoria salarial com este código neste estabelecimento." });

        var entity = new CategoriaSalarial
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            IsActive = request.IsActive,
            EmpresaId = request.EmpresaId,
            EstabelecimentoId = request.EstabelecimentoId
        };

        db.CategoriasSalariais.Add(entity);
        await db.SaveChangesAsync(ct);

        var created = await db.CategoriasSalariais
            .AsNoTracking()
            .Where(x => x.Id == entity.Id)
            .Select(x => new CategoriaSalarialResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId, x.EstabelecimentoId,
                x.Empresa != null ? x.Empresa.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Name : null))
            .FirstAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoriaSalarialResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CategoriaSalarialUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CategoriasSalariais.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (await db.CategoriasSalariais.AnyAsync(
            x => x.Id != id &&
                 x.EmpresaId == request.EmpresaId &&
                 x.EstabelecimentoId == request.EstabelecimentoId &&
                 x.Code == request.Code.Trim(), ct))
            return Conflict(new { message = "Já existe outra categoria salarial com este código neste estabelecimento." });

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.IsActive = request.IsActive;
        entity.EmpresaId = request.EmpresaId;
        entity.EstabelecimentoId = request.EstabelecimentoId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        var updated = await db.CategoriasSalariais
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CategoriaSalarialResponse(
                x.Id, x.Code, x.Description, x.IsActive,
                x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId, x.EstabelecimentoId,
                x.Empresa != null ? x.Empresa.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Code : null,
                x.Estabelecimento != null ? x.Estabelecimento.Name : null))
            .FirstAsync(ct);

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
        var entity = await db.CategoriasSalariais.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.CategoriasSalariais.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Importação em lote de categorias salariais. Upsert por (EmpresaCodigo, EstabelecimentoCodigo, Code).
    /// Suporta até 5.000 registros por requisição.
    /// </summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(CategoriaSalarialImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoriaSalarialImportResult>> Import(
        [FromBody] List<CategoriaSalarialImportItem> items,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Nenhum item fornecido." });
        if (items.Count > 5000)
            return BadRequest(new { message = "Máximo de 5.000 registros por importação." });

        var empresaMap = await db.Empresas
            .AsNoTracking()
            .Select(x => new { x.Id, x.Code })
            .ToDictionaryAsync(x => x.Code.ToLowerInvariant(), x => x.Id, ct);

        var unidadeMap = await db.Units
            .AsNoTracking()
            .Select(x => new { x.Id, x.Code })
            .ToDictionaryAsync(x => x.Code.ToLowerInvariant(), x => x.Id, ct);

        // Existing map: "empresaCode|estabelecimentoCode|code"
        var existingList = await db.CategoriasSalariais
            .AsNoTracking()
            .Select(x => new
            {
                x.Id, x.Code,
                EmpresaCode = x.Empresa != null ? x.Empresa.Code : null,
                EstabCode = x.Estabelecimento != null ? x.Estabelecimento.Code : null
            })
            .ToListAsync(ct);
        var existingDict = existingList.ToDictionary(
            x => $"{(x.EmpresaCode ?? "").ToLowerInvariant()}|{(x.EstabCode ?? "").ToLowerInvariant()}|{x.Code.ToLowerInvariant()}",
            x => x.Id);

        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();
        var toAdd = new List<CategoriaSalarial>();
        int pending = 0;

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var code = item.Code.Trim();
            Guid? empresaId = null;
            Guid? estabId = null;
            string empresaKey = "", estabKey = "";

            if (!string.IsNullOrWhiteSpace(item.EmpresaCodigo))
            {
                if (empresaMap.TryGetValue(item.EmpresaCodigo.Trim().ToLowerInvariant(), out var eid))
                { empresaId = eid; empresaKey = item.EmpresaCodigo.Trim().ToLowerInvariant(); }
                else { errors.Add($"Linha {i + 1}: Empresa '{item.EmpresaCodigo}' não encontrada."); skipped++; continue; }
            }

            if (!string.IsNullOrWhiteSpace(item.EstabelecimentoCodigo))
            {
                if (unidadeMap.TryGetValue(item.EstabelecimentoCodigo.Trim().ToLowerInvariant(), out var uid))
                { estabId = uid; estabKey = item.EstabelecimentoCodigo.Trim().ToLowerInvariant(); }
                else { errors.Add($"Linha {i + 1}: Estabelecimento '{item.EstabelecimentoCodigo}' não encontrado."); skipped++; continue; }
            }

            var mapKey = $"{empresaKey}|{estabKey}|{code.ToLowerInvariant()}";

            if (existingDict.TryGetValue(mapKey, out var existingId))
            {
                var entity = await db.CategoriasSalariais.FindAsync([existingId], ct);
                if (entity is null) { skipped++; continue; }
                entity.Code = code;
                entity.Description = item.Description.Trim();
                entity.IsActive = item.IsActive;
                entity.EmpresaId = empresaId;
                entity.EstabelecimentoId = estabId;
                entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                updated++;
            }
            else
            {
                var entity = new CategoriaSalarial
                {
                    Id = Guid.NewGuid(),
                    Code = code,
                    Description = item.Description.Trim(),
                    IsActive = item.IsActive,
                    EmpresaId = empresaId,
                    EstabelecimentoId = estabId,
                };
                toAdd.Add(entity);
                existingDict[mapKey] = entity.Id;
                created++;
            }

            pending++;
            if (pending >= 100)
            {
                if (toAdd.Count > 0) { db.CategoriasSalariais.AddRange(toAdd); toAdd.Clear(); }
                await db.SaveChangesAsync(ct);
                pending = 0;
            }
        }

        if (toAdd.Count > 0) db.CategoriasSalariais.AddRange(toAdd);
        if (pending > 0) await db.SaveChangesAsync(ct);

        return Ok(new CategoriaSalarialImportResult(created, updated, skipped, errors));
    }
}
