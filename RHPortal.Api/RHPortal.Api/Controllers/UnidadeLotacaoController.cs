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
/// Cadastro de Unidades de Lotação para integração TOTVS Datasul.
/// Suporta hierarquia pai-filho, nível e responsável por FK.
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
    [ProducesResponseType(typeof(List<UnidadeLotacaoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<UnidadeLotacaoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] Guid? parentId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.UnidadesLotacao.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(s) ||
                x.Description.ToLower().Contains(s));
        }

        if (parentId.HasValue)
            query = query.Where(x => x.ParentId == parentId.Value);

        var total = await query.CountAsync(ct);

        // Carregar com navegação para pai e responsável
        var raw = await query
            .Include(x => x.Parent)
            .Include(x => x.OwnerFuncionario)
            .OrderBy(x => x.Level)
            .ThenBy(x => x.SequenceNumber)
            .ThenBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

        // Calcular nível na nossa árvore (profundidade) para todos os registros carregados
        var allIds = raw.Select(x => x.Id).ToHashSet();
        var calculatedLevels = await CalculateDepthsAsync(db, raw, ct);

        var items = raw.Select(x => ToResponse(x, calculatedLevels.GetValueOrDefault(x.Id, 1))).ToList();

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("tree")]
    [ProducesResponseType(typeof(List<UnidadeLotacaoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<UnidadeLotacaoResponse>>> Tree(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var all = await db.UnidadesLotacao
            .AsNoTracking()
            .Include(x => x.Parent)
            .Include(x => x.OwnerFuncionario)
            .OrderBy(x => x.Level)
            .ThenBy(x => x.SequenceNumber)
            .ThenBy(x => x.Code)
            .ToListAsync(ct);

        var calculatedLevels = await CalculateDepthsAsync(db, all, ct);
        var result = all.Select(x => ToResponse(x, calculatedLevels.GetValueOrDefault(x.Id, 1))).ToList();
        return Ok(result);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<UnidadeLotacaoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<UnidadeLotacaoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] string? cdnPlanoLotac)
    {
        var query = db.UnidadesLotacao.AsNoTracking().Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(cdnPlanoLotac))
            query = query.Where(x => x.CdnPlanoLotac == cdnPlanoLotac);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(s) ||
                x.Description.ToLower().Contains(s));
        }

        var raw = await query
            .OrderBy(x => x.Code)
            .Select(x => new { x.Id, x.Code, x.Description })
            .ToListAsync(ct);

        var items = raw
            .DistinctBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .Select(x => new UnidadeLotacaoLookupItem(x.Id, x.Code, x.Description, $"{x.Code} - {x.Description}"))
            .ToList();

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
            .Include(x => x.Parent)
            .Include(x => x.OwnerFuncionario)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (item is null) return NotFound();

        var depths = await CalculateDepthsAsync(db, [item], ct);
        return Ok(ToResponse(item, depths.GetValueOrDefault(item.Id, 1)));
    }

    [HttpPost]
    [ProducesResponseType(typeof(UnidadeLotacaoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UnidadeLotacaoResponse>> Create(
        [FromBody] UnidadeLotacaoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.UnidadesLotacao.AnyAsync(x => x.CdnPlanoLotac == request.CdnPlanoLotac && x.Code == request.Code, ct))
            return Conflict(new { message = "Unidade de Lotação com este código já existe neste plano" });

        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            var parentExists = await db.UnidadesLotacao.AnyAsync(x => x.Id == request.ParentId.Value, ct);
            if (!parentExists)
                return Conflict(new { message = "Unidade pai não encontrada" });
        }

        if (request.OwnerFuncionarioId.HasValue && request.OwnerFuncionarioId.Value != Guid.Empty)
        {
            var funcExists = await db.Funcionarios.AnyAsync(x => x.Id == request.OwnerFuncionarioId.Value, ct);
            if (!funcExists)
                return Conflict(new { message = "Funcionário responsável não encontrado" });
        }

        var entity = new UnidadeLotacao
        {
            Id = Guid.NewGuid(),
            CdnPlanoLotac = string.IsNullOrWhiteSpace(request.CdnPlanoLotac) ? "" : request.CdnPlanoLotac.Trim(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            IsActive = request.IsActive,
            ParentId = request.ParentId == Guid.Empty ? null : request.ParentId,
            Level = request.Level < 1 ? 1 : request.Level,
            SequenceNumber = request.SequenceNumber,
            OwnerFuncionarioId = request.OwnerFuncionarioId == Guid.Empty ? null : request.OwnerFuncionarioId,
        };

        db.UnidadesLotacao.Add(entity);
        await db.SaveChangesAsync(ct);

        // Recarregar com navegação
        await db.Entry(entity).Reference(x => x.Parent).LoadAsync(ct);
        await db.Entry(entity).Reference(x => x.OwnerFuncionario).LoadAsync(ct);

        var depths = await CalculateDepthsAsync(db, [entity], ct);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, ToResponse(entity, depths.GetValueOrDefault(entity.Id, 1)));
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
        var entity = await db.UnidadesLotacao
            .Include(x => x.Parent)
            .Include(x => x.OwnerFuncionario)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (await db.UnidadesLotacao.AnyAsync(x => x.Id != id && x.CdnPlanoLotac == request.CdnPlanoLotac && x.Code == request.Code, ct))
            return Conflict(new { message = "Unidade de Lotação com este código já existe neste plano" });

        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            if (request.ParentId.Value == id)
                return Conflict(new { message = "Uma unidade não pode ser pai de si mesma" });

            var descendantIds = await GetDescendantIdsAsync(db, id, ct);
            if (descendantIds.Contains(request.ParentId.Value))
                return Conflict(new { message = "Hierarquia cíclica detectada: a unidade pai é descendente desta unidade" });

            var parentExists = await db.UnidadesLotacao.AnyAsync(x => x.Id == request.ParentId.Value, ct);
            if (!parentExists)
                return Conflict(new { message = "Unidade pai não encontrada" });
        }

        if (request.OwnerFuncionarioId.HasValue && request.OwnerFuncionarioId.Value != Guid.Empty)
        {
            var funcExists = await db.Funcionarios.AnyAsync(x => x.Id == request.OwnerFuncionarioId.Value, ct);
            if (!funcExists)
                return Conflict(new { message = "Funcionário responsável não encontrado" });
        }

        if (!string.IsNullOrWhiteSpace(request.CdnPlanoLotac))
            entity.CdnPlanoLotac = request.CdnPlanoLotac.Trim();
        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.IsActive = request.IsActive;
        entity.ParentId = request.ParentId == Guid.Empty ? null : request.ParentId;
        entity.Level = request.Level < 1 ? 1 : request.Level;
        entity.SequenceNumber = request.SequenceNumber;
        entity.OwnerFuncionarioId = request.OwnerFuncionarioId == Guid.Empty ? null : request.OwnerFuncionarioId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        // Recarregar navegação após save
        await db.Entry(entity).Reference(x => x.Parent).LoadAsync(ct);
        await db.Entry(entity).Reference(x => x.OwnerFuncionario).LoadAsync(ct);

        var depths = await CalculateDepthsAsync(db, [entity], ct);
        return Ok(ToResponse(entity, depths.GetValueOrDefault(entity.Id, 1)));
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
        var entity = await db.UnidadesLotacao
            .Include(x => x.Children)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (entity.Children is { Count: > 0 })
            return Conflict(new { message = "Não é possível excluir uma unidade que possui unidades filhas" });

        db.UnidadesLotacao.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Importação em lote de unidades de lotação. Upsert por Code.
    /// Suporta até 5.000 registros por requisição.
    /// </summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(UnidadeLotacaoImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UnidadeLotacaoImportResult>> Import(
        [FromBody] List<UnidadeLotacaoImportItem> items,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Nenhum item fornecido." });
        if (items.Count > 5000)
            return BadRequest(new { message = "Máximo de 5.000 registros por importação." });

        // Chave composta: "{plano}|{code_normalizado}" — tolera zeros à esquerda
        static string UnitKey(string plan, string code)
        {
            var norm = code.Trim().TrimStart('0') is { Length: > 0 } s ? s : code.Trim();
            return $"{plan.Trim()}|{norm}";
        }

        var existingUnidades = await db.UnidadesLotacao
            .AsNoTracking()
            .Select(x => new { x.Id, x.Code, x.CdnPlanoLotac })
            .ToListAsync(ct);

        var existingCodes = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in existingUnidades)
            existingCodes.TryAdd(UnitKey(u.CdnPlanoLotac, u.Code), u.Id);

        // Parent code → ID map (inclui novos criados nesta importação)
        var parentCodeMap = new Dictionary<string, Guid>(existingCodes, StringComparer.OrdinalIgnoreCase);

        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();
        var warnings = new List<string>();
        var toAdd = new List<UnidadeLotacao>();

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var code = item.Code.Trim();
            var compositeKey = UnitKey(item.CdnPlanoLotac, code);
            Guid? parentId = null;
            if (!string.IsNullOrWhiteSpace(item.ParentCodigo))
            {
                if (!parentCodeMap.TryGetValue(UnitKey(item.CdnPlanoLotac, item.ParentCodigo.Trim()), out var pid))
                    warnings.Add($"Linha {i + 1}: Unidade pai '{item.ParentCodigo}' não encontrada — importada sem pai.");
                else
                    parentId = pid;
            }

            if (existingCodes.TryGetValue(compositeKey, out var existingId))
            {
                var entity = await db.UnidadesLotacao.FindAsync([existingId], ct);
                if (entity is null) { skipped++; continue; }
                entity.CdnPlanoLotac = item.CdnPlanoLotac.Trim();
                entity.Code = code;
                entity.Description = item.Description.Trim();
                entity.Location = string.IsNullOrWhiteSpace(item.Location) ? null : item.Location.Trim();
                entity.Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim();
                entity.IsActive = item.IsActive;
                entity.ParentId = parentId;
                entity.Level = item.Level < 1 ? 1 : item.Level;
                entity.SequenceNumber = item.SequenceNumber;
                entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                updated++;
            }
            else
            {
                var entity = new UnidadeLotacao
                {
                    Id = Guid.NewGuid(),
                    CdnPlanoLotac = item.CdnPlanoLotac.Trim(),
                    Code = code,
                    Description = item.Description.Trim(),
                    Location = string.IsNullOrWhiteSpace(item.Location) ? null : item.Location.Trim(),
                    Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim(),
                    IsActive = item.IsActive,
                    ParentId = parentId,
                    Level = item.Level < 1 ? 1 : item.Level,
                    SequenceNumber = item.SequenceNumber,
                };
                toAdd.Add(entity);
                existingCodes[compositeKey] = entity.Id;
                parentCodeMap[compositeKey] = entity.Id;
                created++;
            }
        }

        if (toAdd.Count > 0) db.UnidadesLotacao.AddRange(toAdd);
        await db.SaveChangesAsync(ct);

        return Ok(new UnidadeLotacaoImportResult(created, updated, skipped, errors, warnings));
    }

    /// <summary>
    /// Importação em lote de responsáveis (passo 4 do fluxo TOTVS).
    /// Vincula OwnerFuncionarioId de cada unidade pelo código da unidade +
    /// chave TOTVS do funcionário (CdnEmpresa + CdnEstab + CdnFuncionario).
    /// Executar APÓS importar colaboradores.
    /// </summary>
    [HttpPost("import-owners")]
    [ProducesResponseType(typeof(UnidadeLotacaoOwnerImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UnidadeLotacaoOwnerImportResult>> ImportOwners(
        [FromBody] List<UnidadeLotacaoOwnerImportItem> items,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Nenhum item fornecido." });
        if (items.Count > 5000)
            return BadRequest(new { message = "Máximo de 5.000 registros por importação." });

        // Pré-carrega mapa "{plano}|{code_normalizado}" → Id das unidades.
        // Indexa exact e sem zeros à esquerda para tolerar divergência Excel/TOTVS.
        static string OwnerUnitKey(string plan, string code)
        {
            var norm = code.Trim().TrimStart('0') is { Length: > 0 } s ? s : code.Trim();
            return $"{plan.Trim()}|{norm}";
        }

        var unitRaw = await db.UnidadesLotacao
            .AsNoTracking()
            .Select(x => new { x.Id, x.Code, x.CdnPlanoLotac })
            .ToListAsync(ct);

        var unitMap = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in unitRaw)
        {
            var exact = u.Code.Trim();
            var stripped = exact.TrimStart('0') is { Length: > 0 } s ? s : exact;
            unitMap.TryAdd(OwnerUnitKey(u.CdnPlanoLotac, exact), u.Id);
            unitMap.TryAdd(OwnerUnitKey(u.CdnPlanoLotac, stripped), u.Id);
        }

        // Pré-carrega mapa chave TOTVS → Id dos funcionários
        var funcMap = await db.Funcionarios
            .AsNoTracking()
            .Where(x => x.CdnFuncionario != null)
            .Select(x => new { x.Id, x.CdnEmpresa, x.CdnEstab, x.CdnFuncionario })
            .ToListAsync(ct);

        var funcLookup = funcMap.ToDictionary(
            x => $"{x.CdnEmpresa?.Trim()}|{x.CdnEstab?.Trim()}|{x.CdnFuncionario?.Trim()}",
            x => x.Id);

        int updated = 0, unidadeNaoEncontrada = 0, funcionarioNaoEncontrado = 0;
        var errors = new List<string>();

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var unitCodeRaw = item.UnitCode.Trim();
            var unitStripped = unitCodeRaw.TrimStart('0') is { Length: > 0 } us ? us : unitCodeRaw;
            var unitKey = OwnerUnitKey(item.CdnPlanoLotac, unitStripped);
            var funcKey = $"{item.CdnEmpresa.Trim()}|{item.CdnEstab.Trim()}|{item.CdnFuncionario.Trim()}";

            if (!unitMap.TryGetValue(unitKey, out var unitId))
            {
                unidadeNaoEncontrada++;
                errors.Add($"Linha {i + 1}: Unidade '{item.UnitCode}' não encontrada.");
                continue;
            }

            if (!funcLookup.TryGetValue(funcKey, out var funcId))
            {
                funcionarioNaoEncontrado++;
                errors.Add($"Linha {i + 1}: Funcionário {item.CdnEmpresa}/{item.CdnEstab}/{item.CdnFuncionario} não encontrado.");
                continue;
            }

            var entity = await db.UnidadesLotacao.FindAsync([unitId], ct);
            if (entity is null) { unidadeNaoEncontrada++; continue; }

            entity.OwnerFuncionarioId = funcId;
            entity.OwnerCdnEmpresa = item.CdnEmpresa.Trim();
            entity.OwnerCdnEstab = item.CdnEstab.Trim();
            entity.OwnerCdnFuncionario = item.CdnFuncionario.Trim();
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            updated++;
        }

        await db.SaveChangesAsync(ct);

        return Ok(new UnidadeLotacaoOwnerImportResult(updated, unidadeNaoEncontrada, funcionarioNaoEncontrado, errors));
    }

    // ── helpers ──

    private static UnidadeLotacaoResponse ToResponse(UnidadeLotacao x, int calculatedLevel) =>
        new(
            x.Id,
            x.CdnPlanoLotac,
            x.Code,
            x.Description,
            x.Location,
            x.Notes,
            x.IsActive,
            x.ParentId,
            x.Parent?.Code,
            x.Parent?.Description,
            x.Level,
            calculatedLevel,
            x.SequenceNumber,
            x.OwnerFuncionarioId,
            x.OwnerFuncionario?.Name,
            x.OwnerCdnEmpresa,
            x.OwnerCdnEstab,
            x.OwnerCdnFuncionario,
            x.CreatedAtUtc,
            x.UpdatedAtUtc
        );

    /// <summary>
    /// Calcula a profundidade real de cada unidade na árvore (1 = raiz).
    /// Percorre os pais iterativamente para evitar N+1.
    /// </summary>
    private static async Task<Dictionary<Guid, int>> CalculateDepthsAsync(
        AppDbContext db, IEnumerable<UnidadeLotacao> items, CancellationToken ct)
    {
        var result = new Dictionary<Guid, int>();
        var allParentIds = new HashSet<Guid>();

        foreach (var item in items)
        {
            if (item.ParentId.HasValue)
                allParentIds.Add(item.ParentId.Value);
        }

        // Carregar mapa completo de id→parentId para calcular profundidade
        var parentMap = await db.UnidadesLotacao
            .AsNoTracking()
            .Select(x => new { x.Id, x.ParentId })
            .ToDictionaryAsync(x => x.Id, x => x.ParentId, ct);

        foreach (var item in items)
        {
            var depth = 1;
            var current = item.ParentId;
            var visited = new HashSet<Guid> { item.Id };

            while (current.HasValue && parentMap.TryGetValue(current.Value, out var next))
            {
                if (!visited.Add(current.Value)) break; // proteção anti-ciclo
                depth++;
                current = next;
            }

            result[item.Id] = depth;
        }

        return result;
    }

    /// <summary>
    /// Retorna IDs de todos os descendentes de uma unidade (para detecção de ciclo).
    /// </summary>
    private static async Task<HashSet<Guid>> GetDescendantIdsAsync(AppDbContext db, Guid unitId, CancellationToken ct)
    {
        var result = new HashSet<Guid>();
        var current = new List<Guid> { unitId };

        while (current.Count > 0)
        {
            var children = await db.UnidadesLotacao
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
