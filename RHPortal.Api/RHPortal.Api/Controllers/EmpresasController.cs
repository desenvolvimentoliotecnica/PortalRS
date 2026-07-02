using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Geocoding;
using RhPortal.Api.Contracts.Empresa;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Empresas (agrupador de Estabelecimentos).
/// Sessão 31.8: endereço completo + geocoding para matching por distância.
/// Importação RM (GFILIAL) usa POST/PUT deste controller; pós-sync chama geocodificar-pendentes.
/// </summary>
[ApiController]
[Route("api/empresas")]
public sealed class EmpresasController : ControllerBase
{
    private static EmpresaResponse MapToResponse(Empresa x) =>
        new(
            x.Id, x.Code, x.Description, x.IsActive,
            x.CreatedAtUtc, x.UpdatedAtUtc,
            x.Cep, x.Logradouro, x.Numero, x.Bairro, x.Cidade, x.Uf,
            x.Latitude, x.Longitude, x.GeocodificadoEmUtc);

    [HttpGet]
    [ProducesResponseType(typeof(List<EmpresaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<EmpresaResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100)
    {
        var query = db.Empresas.AsNoTracking();

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
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items.Select(MapToResponse).ToList());
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<EmpresaLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<EmpresaLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var query = db.Empresas.AsNoTracking().Where(x => x.IsActive);

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
            .Select(x => new EmpresaLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} – {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmpresaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Empresas.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return entity is null ? NotFound() : Ok(MapToResponse(entity));
    }

    [HttpPost]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EmpresaResponse>> Create(
        [FromBody] EmpresaCreateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] EmpresaGeocodificacaoService geocoding,
        CancellationToken ct)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Empresas.AnyAsync(x => x.Code == code, ct))
            return Conflict(new { message = $"Empresa com o código '{code}' já existe." });

        var entity = new Empresa
        {
            Id = Guid.NewGuid(),
            Code = code,
            Description = request.Description.Trim(),
            IsActive = request.IsActive,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        await geocoding.ApplyEnderecoEGeocodificarAsync(
            entity, request.Cep, request.Logradouro, request.Numero,
            request.Bairro, request.Cidade, request.Uf,
            preserveExistingAddressWhenNull: false, ct);

        db.Empresas.Add(entity);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, MapToResponse(entity));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EmpresaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] EmpresaUpdateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] EmpresaGeocodificacaoService geocoding,
        CancellationToken ct)
    {
        var entity = await db.Empresas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Empresas.AnyAsync(x => x.Id != id && x.Code == code, ct))
            return Conflict(new { message = $"Empresa com o código '{code}' já existe." });

        entity.Code = code;
        entity.Description = request.Description.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await geocoding.ApplyEnderecoEGeocodificarAsync(
            entity, request.Cep, request.Logradouro, request.Numero,
            request.Bairro, request.Cidade, request.Uf,
            preserveExistingAddressWhenNull: true, ct);

        await db.SaveChangesAsync(ct);

        return Ok(MapToResponse(entity));
    }

    [HttpPost("{id:guid}/geocodificar")]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<EmpresaResponse>> Geocodificar(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        [FromServices] EmpresaGeocodificacaoService geocoding,
        CancellationToken ct)
    {
        var entity = await db.Empresas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (string.IsNullOrWhiteSpace(entity.Cep) && string.IsNullOrWhiteSpace(entity.Cidade))
        {
            return UnprocessableEntity(new
            {
                message = "Empresa sem CEP ou cidade. Preencha o endereço antes de geocodificar.",
            });
        }

        var ok = await geocoding.TryGeocodificarAsync(entity, limparCoordsSeFalhar: false, ct);
        if (!ok)
        {
            return UnprocessableEntity(new
            {
                message = "Não foi possível obter latitude/longitude (tentamos enriquecer o endereço via CEP e consultar Nominatim, Photon e BrasilAPI). Verifique CEP, cidade e logradouro; endereços abreviados vindos do RM podem precisar de ajuste manual se o CEP não for encontrado.",
            });
        }

        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(MapToResponse(entity));
    }

    /// <summary>
    /// Geocodifica empresas ativas sem coordenadas. Usado pelo integrador RM após sync GFILIAL
    /// e pelo backfill de startup (rate limit ~1 req/s).
    /// </summary>
    [HttpPost("geocodificar-pendentes")]
    [ProducesResponseType(typeof(EmpresaGeocodificarPendentesResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmpresaGeocodificarPendentesResponse>> GeocodificarPendentes(
        [FromServices] AppDbContext db,
        [FromServices] EmpresaGeocodificacaoService geocoding,
        CancellationToken ct,
        [FromQuery] int take = 50)
    {
        var result = await geocoding.GeocodificarPendentesAsync(db, take, ct);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.Empresas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        entity.IsActive = false;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
