using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.DescricaoCargo;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Descrições de Cargo — segue o template DNALIO (Sessão 31.8).
///
/// Estrutura:
/// - Cabeçalho: Code/Title/AreaTemplate/CboCodigo/Summary
/// - Formação: mínima/desejável/área de estudo
/// - Experiência: tempo mínimo/desejável/especificação
/// - Itens (collection) com 8 categorias DNALIO (atividades, vivências,
///   competências, requisitos)
/// - Revisão: número/data/natureza/gestor
/// - HTML legados (Responsibilities/Requirements/NiceToHave/Benefits) para
///   apresentação pública
///
/// O matching consome os Itens estruturados; o RH cadastra usando essa tela.
/// </summary>
[ApiController]
[Route("api/descricoes-cargo")]
public sealed class DescricaoCargoController : ControllerBase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string? NullIfBlank(string? s)
        => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static DescricaoCargoItemResponse MapItem(DescricaoCargoItem i) =>
        new(i.Id, i.Categoria, i.Texto, i.IsObrigatoria, i.NivelMinimo, i.Subcategoria, i.Ordem);

    private static DescricaoCargoResponse MapToResponse(DescricaoCargo x) =>
        new(
            x.Id, x.Code, x.Title,
            x.AreaTemplate, x.CboCodigo, x.Summary,
            x.FormacaoMinima, x.FormacaoDesejavel, x.FormacaoAreaEstudo,
            x.ExperienciaTempoMinimo, x.ExperienciaTempoDesejavel, x.ExperienciaEspecificacao,
            x.RevisaoNumero, x.RevisaoData, x.RevisaoNatureza, x.GestorNome, x.GestorEmail,
            x.Responsibilities, x.Requirements, x.NiceToHave, x.Benefits,
            x.IsTemplate, x.IsActive,
            x.CreatedAtUtc, x.UpdatedAtUtc,
            x.NivelCargoId,
            x.NivelCargo?.NomComplet,
            x.Itens
                .OrderBy(i => i.Categoria)
                .ThenBy(i => i.Ordem)
                .ThenBy(i => i.Texto)
                .Select(MapItem)
                .ToList());

    /// <summary>Substitui todos os itens da descrição pelos recebidos no request (pattern replace).</summary>
    private static void ReplaceItens(
        DescricaoCargo entity,
        IReadOnlyList<DescricaoCargoItemRequest>? itens,
        string tenantId,
        AppDbContext db)
    {
        foreach (var existing in entity.Itens.ToList())
            db.Remove(existing);
        entity.Itens.Clear();

        if (itens is null) return;

        foreach (var i in itens)
        {
            entity.Itens.Add(new DescricaoCargoItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DescricaoCargoId = entity.Id,
                Categoria = i.Categoria,
                Texto = i.Texto.Trim(),
                IsObrigatoria = i.IsObrigatoria,
                NivelMinimo = NullIfBlank(i.NivelMinimo),
                Subcategoria = NullIfBlank(i.Subcategoria),
                Ordem = i.Ordem,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
    }

    private static void ApplyHeaderFields(DescricaoCargo entity, dynamic request)
    {
        entity.AreaTemplate = NullIfBlank((string?)request.AreaTemplate);
        entity.CboCodigo = NullIfBlank((string?)request.CboCodigo);
        entity.Summary = NullIfBlank((string?)request.Summary);
        entity.FormacaoMinima = NullIfBlank((string?)request.FormacaoMinima);
        entity.FormacaoDesejavel = NullIfBlank((string?)request.FormacaoDesejavel);
        entity.FormacaoAreaEstudo = NullIfBlank((string?)request.FormacaoAreaEstudo);
        entity.ExperienciaTempoMinimo = NullIfBlank((string?)request.ExperienciaTempoMinimo);
        entity.ExperienciaTempoDesejavel = NullIfBlank((string?)request.ExperienciaTempoDesejavel);
        entity.ExperienciaEspecificacao = NullIfBlank((string?)request.ExperienciaEspecificacao);
        entity.RevisaoNumero = NullIfBlank((string?)request.RevisaoNumero);
        entity.RevisaoData = (DateOnly?)request.RevisaoData;
        entity.RevisaoNatureza = NullIfBlank((string?)request.RevisaoNatureza);
        entity.GestorNome = NullIfBlank((string?)request.GestorNome);
        entity.GestorEmail = NullIfBlank((string?)request.GestorEmail);
        entity.Responsibilities = NullIfBlank((string?)request.Responsibilities);
        entity.Requirements = NullIfBlank((string?)request.Requirements);
        entity.NiceToHave = NullIfBlank((string?)request.NiceToHave);
        entity.Benefits = NullIfBlank((string?)request.Benefits);
        entity.IsTemplate = (bool)request.IsTemplate;
        entity.IsActive = (bool)request.IsActive;
        entity.NivelCargoId = (Guid?)request.NivelCargoId;
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

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
        var query = db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .AsQueryable();

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
        var entities = await query
            .OrderBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(entities.Select(MapToResponse).ToList());
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
        var entity = await db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return entity is null ? NotFound() : Ok(MapToResponse(entity));
    }

    [HttpPost]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DescricaoCargoResponse>> Create(
        [FromBody] DescricaoCargoCreateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
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
        };
        ApplyHeaderFields(entity, request);

        db.DescricoesCargo.Add(entity);
        ReplaceItens(entity, request.Itens, tenantContext.TenantId ?? string.Empty, db);

        await db.SaveChangesAsync(ct);

        var created = await db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .FirstAsync(x => x.Id == entity.Id, ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, MapToResponse(created));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DescricaoCargoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] DescricaoCargoUpdateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        var entity = await db.DescricoesCargo
            .Include(x => x.Itens)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
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
        ApplyHeaderFields(entity, request);
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        ReplaceItens(entity, request.Itens, tenantContext.TenantId ?? string.Empty, db);

        await db.SaveChangesAsync(ct);

        var updated = await db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .FirstAsync(x => x.Id == id, ct);

        return Ok(MapToResponse(updated));
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
        var entity = await db.DescricoesCargo.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        // Pre-check: alguma vaga aponta para esta descrição?
        var vagasUsando = await db.Vagas.CountAsync(v => v.DescricaoCargoId == id, ct);
        if (vagasUsando > 0)
        {
            return Conflict(new
            {
                message = $"Não é possível excluir \"{entity.Code} - {entity.Title}\" — {vagasUsando} vaga(s) usam esta descrição. Desvincule as vagas antes.",
                dependencies = new { vagas = vagasUsando }
            });
        }

        // Itens da descrição morrem em Cascade pelo config do AppDbContext.
        db.DescricoesCargo.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
