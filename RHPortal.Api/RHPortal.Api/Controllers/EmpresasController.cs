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
/// Sessão 31.8: estendido com endereço completo + geocoding (Nominatim) para
/// alimentar o cálculo de distância candidato × empresa no MatchingService.
/// </summary>
[ApiController]
[Route("api/empresas")]
public sealed class EmpresasController : ControllerBase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string? NullIfBlank(string? s)
        => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static EmpresaResponse MapToResponse(Empresa x) =>
        new(
            x.Id, x.Code, x.Description, x.IsActive,
            x.CreatedAtUtc, x.UpdatedAtUtc,
            x.Cep, x.Logradouro, x.Numero, x.Bairro, x.Cidade, x.Uf,
            x.Latitude, x.Longitude, x.GeocodificadoEmUtc);

    /// <summary>
    /// Aplica os campos de endereço na entidade. Se o endereço mudou, agenda
    /// nova geocodificação (chamada externa best-effort, falha não bloqueia o save).
    /// </summary>
    private static async Task ApplyEnderecoEGeocodificarAsync(
        Empresa entity,
        string? cep,
        string? logradouro,
        string? numero,
        string? bairro,
        string? cidade,
        string? uf,
        IGeocodingService geocoding,
        CancellationToken ct)
    {
        var novoCep = NullIfBlank(cep);
        var novoLog = NullIfBlank(logradouro);
        var novoNum = NullIfBlank(numero);
        var novoBai = NullIfBlank(bairro);
        var novaCid = NullIfBlank(cidade);
        var novaUf = NullIfBlank(uf);

        var enderecoMudou =
            entity.Cep != novoCep ||
            entity.Logradouro != novoLog ||
            entity.Numero != novoNum ||
            entity.Bairro != novoBai ||
            entity.Cidade != novaCid ||
            entity.Uf != novaUf;

        entity.Cep = novoCep;
        entity.Logradouro = novoLog;
        entity.Numero = novoNum;
        entity.Bairro = novoBai;
        entity.Cidade = novaCid;
        entity.Uf = novaUf;

        // Geocodifica se o endereço mudou ou se nunca foi geocodificado e há dados úteis
        if (enderecoMudou || (entity.Latitude is null && (novoCep != null || novaCid != null)))
        {
            var result = await geocoding.GeocodeAsync(novoCep, novoLog, novoNum, novaCid, novaUf, ct);
            if (result is not null)
            {
                entity.Latitude = result.Latitude;
                entity.Longitude = result.Longitude;
                entity.GeocodificadoEmUtc = DateTimeOffset.UtcNow;
            }
            else if (enderecoMudou)
            {
                // Endereço mudou mas geocoding falhou — limpa coords antigas pra não usar valor errado
                entity.Latitude = null;
                entity.Longitude = null;
                entity.GeocodificadoEmUtc = null;
            }
        }
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

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
        [FromServices] IGeocodingService geocoding,
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

        await ApplyEnderecoEGeocodificarAsync(
            entity, request.Cep, request.Logradouro, request.Numero,
            request.Bairro, request.Cidade, request.Uf, geocoding, ct);

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
        [FromServices] IGeocodingService geocoding,
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

        await ApplyEnderecoEGeocodificarAsync(
            entity, request.Cep, request.Logradouro, request.Numero,
            request.Bairro, request.Cidade, request.Uf, geocoding, ct);

        await db.SaveChangesAsync(ct);

        return Ok(MapToResponse(entity));
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
