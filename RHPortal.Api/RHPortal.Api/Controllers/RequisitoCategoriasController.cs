using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.RequisitoCategorias;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de funções (cargo/função do RM, sincronizado via PFUNCAO).
/// </summary>
[ApiController]
[Route("api/requisito-categorias")]
public sealed class RequisitoCategoriasController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public RequisitoCategoriasController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    /// <summary>
    /// Lista funções (cargo/função).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<RequisitoCategoriaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RequisitoCategoriaResponse>>> List([FromServices] AppDbContext db, CancellationToken ct)
    {
        var items = await db.RequisitoCategorias
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new RequisitoCategoriaResponse(x.Id, x.Code, x.Name, x.Description, x.IsActive))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Consulta uma função pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(RequisitoCategoriaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RequisitoCategoriaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.RequisitoCategorias
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new RequisitoCategoriaResponse(x.Id, x.Code, x.Name, x.Description, x.IsActive))
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria uma nova função.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(RequisitoCategoriaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RequisitoCategoriaResponse>> Create(
        [FromBody] RequisitoCategoriaCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.RequisitoCategorias.AnyAsync(x => x.Code == request.Code, ct))
            return Conflict(new { message = _localizer["ControllerErrors.RequisitoCategoriaCodeExists", request.Code] });

        var entity = new Domain.Entities.RequisitoCategoria
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = request.IsActive
        };

        db.RequisitoCategorias.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = new RequisitoCategoriaResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.IsActive);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    /// <summary>
    /// Atualiza uma função.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(RequisitoCategoriaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RequisitoCategoriaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] RequisitoCategoriaUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.RequisitoCategorias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codeExists = await db.RequisitoCategorias.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeExists)
            return Conflict(new { message = _localizer["ControllerErrors.RequisitoCategoriaCodeExists", request.Code] });

        entity.Code = request.Code.Trim();
        entity.Name = request.Name.Trim();
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.IsActive = request.IsActive;

        await db.SaveChangesAsync(ct);

        return Ok(new RequisitoCategoriaResponse(entity.Id, entity.Code, entity.Name, entity.Description, entity.IsActive));
    }

    /// <summary>
    /// Remove uma função (se não houver dependências).
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
        var entity = await db.RequisitoCategorias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var code = (entity.Code ?? string.Empty).Trim().ToLowerInvariant();
        var name = (entity.Name ?? string.Empty).Trim().ToLowerInvariant();

        var hasDeps = await db.VagaRequisitos.AnyAsync(x =>
            x.Categoria != null &&
            (x.Categoria.ToLower() == code || x.Categoria.ToLower() == name), ct);

        if (hasDeps)
            return Conflict(new { message = _localizer["ControllerErrors.RequisitoCategoriaHasDependencies"] });

        db.RequisitoCategorias.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
