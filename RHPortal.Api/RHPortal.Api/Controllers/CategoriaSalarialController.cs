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
/// Cadastro de Categorias Salariais — grade salarial por cargo.
///
/// Cada categoria define um <c>ValorBase</c> (salário de referência em 100%) e
/// uma coleção de <c>Steps</c> (degraus percentuais: 80%, 85%, …, 120%, ou livre).
/// O valor de cada step é calculado (<c>ValorBase × Percentual/100</c>) quando
/// <c>ValorOverride</c> é null; caso contrário, o override prevalece.
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>Valor efetivo do step: override quando presente, caso contrário calculado.</summary>
    private static decimal? ComputeValorEfetivo(decimal? valorBase, decimal percentual, decimal? valorOverride)
    {
        if (valorOverride.HasValue) return valorOverride.Value;
        if (valorBase.HasValue) return Math.Round(valorBase.Value * percentual / 100m, 2);
        return null;
    }

    private static CategoriaSalarialStepResponse MapStep(CategoriaSalarialStep s, decimal? valorBase) =>
        new(
            s.Id,
            s.Percentual,
            s.ValorOverride,
            s.Ordem,
            s.Observacao,
            ComputeValorEfetivo(valorBase, s.Percentual, s.ValorOverride));

    private static CategoriaSalarialResponse MapToResponse(CategoriaSalarial x) =>
        new(
            x.Id, x.Code, x.Description, x.IsActive,
            x.CreatedAtUtc, x.UpdatedAtUtc,
            x.ValorBase,
            x.EmpresaId, x.EstabelecimentoId,
            x.Empresa?.Code,
            x.Estabelecimento?.Code,
            x.Estabelecimento?.Name,
            x.Steps
                .OrderBy(s => s.Ordem)
                .ThenBy(s => s.Percentual)
                .Select(s => MapStep(s, x.ValorBase))
                .ToList());

    /// <summary>Substitui todos os steps da categoria pelos recebidos no request (pattern replace).</summary>
    private static void ReplaceSteps(
        CategoriaSalarial entity,
        IReadOnlyList<CategoriaSalarialStepRequest>? steps,
        string tenantId,
        AppDbContext db)
    {
        // Remove os existentes — Cascade no DbContext garante que não sobre lixo órfão.
        foreach (var existing in entity.Steps.ToList())
            db.Remove(existing);
        entity.Steps.Clear();

        if (steps is null) return;

        foreach (var s in steps)
        {
            entity.Steps.Add(new CategoriaSalarialStep
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CategoriaSalarialId = entity.Id,
                Percentual = s.Percentual,
                ValorOverride = s.ValorOverride,
                Ordem = s.Ordem,
                Observacao = string.IsNullOrWhiteSpace(s.Observacao) ? null : s.Observacao.Trim(),
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    [HttpGet]
    [ProducesResponseType(typeof(List<CategoriaSalarialResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CategoriaSalarialResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 5000)
    {
        var query = db.CategoriasSalariais
            .AsNoTracking()
            .Include(x => x.Empresa)
            .Include(x => x.Estabelecimento)
            .Include(x => x.Steps)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(searchLower) ||
                x.Description.ToLower().Contains(searchLower));
        }

        var total = await query.CountAsync(ct);
        var entities = await query
            .OrderBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(entities.Select(MapToResponse).ToList());
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
        var entity = await db.CategoriasSalariais
            .AsNoTracking()
            .Include(x => x.Empresa)
            .Include(x => x.Estabelecimento)
            .Include(x => x.Steps)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return entity is null ? NotFound() : Ok(MapToResponse(entity));
    }

    [HttpPost]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoriaSalarialResponse>> Create(
        [FromBody] CategoriaSalarialCreateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] RhPortal.Api.Infrastructure.Tenancy.ITenantContext tenantContext,
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
            ValorBase = request.ValorBase,
            EmpresaId = request.EmpresaId,
            EstabelecimentoId = request.EstabelecimentoId,
        };

        db.CategoriasSalariais.Add(entity);

        ReplaceSteps(entity, request.Steps, tenantContext.TenantId ?? string.Empty, db);

        await db.SaveChangesAsync(ct);

        var created = await db.CategoriasSalariais
            .AsNoTracking()
            .Include(x => x.Empresa)
            .Include(x => x.Estabelecimento)
            .Include(x => x.Steps)
            .FirstAsync(x => x.Id == entity.Id, ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, MapToResponse(created));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CategoriaSalarialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoriaSalarialResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CategoriaSalarialUpdateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] RhPortal.Api.Infrastructure.Tenancy.ITenantContext tenantContext,
        CancellationToken ct)
    {
        var entity = await db.CategoriasSalariais
            .Include(x => x.Steps)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
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
        entity.ValorBase = request.ValorBase;
        entity.EmpresaId = request.EmpresaId;
        entity.EstabelecimentoId = request.EstabelecimentoId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        ReplaceSteps(entity, request.Steps, tenantContext.TenantId ?? string.Empty, db);

        await db.SaveChangesAsync(ct);

        var updated = await db.CategoriasSalariais
            .AsNoTracking()
            .Include(x => x.Empresa)
            .Include(x => x.Estabelecimento)
            .Include(x => x.Steps)
            .FirstAsync(x => x.Id == id, ct);

        return Ok(MapToResponse(updated));
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

        // Steps morrem em cascade pelo config do AppDbContext.
        db.CategoriasSalariais.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Importação em lote de categorias salariais. Upsert por (EmpresaCodigo,
    /// EstabelecimentoCodigo, Code). Steps da grade NÃO são importados por aqui —
    /// o XLSX mantém a forma simples (só Code/Description/ValorBase), e a grade
    /// é editada por tela. Suporta até 5.000 registros por requisição.
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
                entity.ValorBase = item.ValorBase;
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
                    ValorBase = item.ValorBase,
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
