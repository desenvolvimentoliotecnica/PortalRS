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
    private const int NominatimMinIntervalMs = 1100;

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
        bool preserveExistingAddressWhenNull,
        IGeocodingService geocoding,
        CancellationToken ct)
    {
        var novoCep = CoalesceAddressField(cep, entity.Cep, preserveExistingAddressWhenNull);
        var novoLog = CoalesceAddressField(logradouro, entity.Logradouro, preserveExistingAddressWhenNull);
        var novoNum = CoalesceAddressField(numero, entity.Numero, preserveExistingAddressWhenNull);
        var novoBai = CoalesceAddressField(bairro, entity.Bairro, preserveExistingAddressWhenNull);
        var novaCid = CoalesceAddressField(cidade, entity.Cidade, preserveExistingAddressWhenNull);
        var novaUf = CoalesceAddressField(uf, entity.Uf, preserveExistingAddressWhenNull);

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

        var precisaGeocodificar =
            enderecoMudou ||
            (entity.Latitude is null && (novoCep != null || novaCid != null));

        if (!precisaGeocodificar)
            return;

        await TryGeocodificarEmpresaAsync(entity, geocoding, limparCoordsSeFalhar: enderecoMudou, ct);
    }

    private static string? CoalesceAddressField(string? incoming, string? existing, bool preserveWhenNull)
    {
        var parsed = NullIfBlank(incoming);
        if (parsed is not null)
            return parsed;
        return preserveWhenNull ? NullIfBlank(existing) : null;
    }

    private static async Task<bool> TryGeocodificarEmpresaAsync(
        Empresa entity,
        IGeocodingService geocoding,
        bool limparCoordsSeFalhar,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(entity.Cep) && string.IsNullOrWhiteSpace(entity.Cidade))
            return false;

        var result = await geocoding.GeocodeAsync(
            entity.Cep, entity.Logradouro, entity.Numero, entity.Cidade, entity.Uf, ct);

        if (result is not null)
        {
            entity.Latitude = result.Latitude;
            entity.Longitude = result.Longitude;
            entity.GeocodificadoEmUtc = DateTimeOffset.UtcNow;
            return true;
        }

        if (limparCoordsSeFalhar)
        {
            entity.Latitude = null;
            entity.Longitude = null;
            entity.GeocodificadoEmUtc = null;
        }

        return false;
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
            request.Bairro, request.Cidade, request.Uf,
            preserveExistingAddressWhenNull: false, geocoding, ct);

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
            request.Bairro, request.Cidade, request.Uf,
            preserveExistingAddressWhenNull: true, geocoding, ct);

        await db.SaveChangesAsync(ct);

        return Ok(MapToResponse(entity));
    }

    /// <summary>
    /// Força geocodificação (Nominatim) a partir do endereço já salvo na empresa.
    /// Útil para registros criados via SQL/importação ou quando o ambiente bloqueou
    /// a chamada externa no momento do save.
    /// </summary>
    [HttpPost("{id:guid}/geocodificar")]
    [ProducesResponseType(typeof(EmpresaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<EmpresaResponse>> Geocodificar(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        [FromServices] IGeocodingService geocoding,
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

        var ok = await TryGeocodificarEmpresaAsync(entity, geocoding, limparCoordsSeFalhar: false, ct);
        if (!ok)
        {
            return UnprocessableEntity(new
            {
                message = "Não foi possível obter latitude/longitude (tentamos Nominatim, Photon e BrasilAPI CEP). Verifique o endereço e se o servidor tem saída HTTPS para nominatim.openstreetmap.org, photon.komoot.io e brasilapi.com.br.",
            });
        }

        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(MapToResponse(entity));
    }

    /// <summary>
    /// Geocodifica empresas ativas que têm cidade/CEP mas ainda não têm coordenadas.
    /// Respeita rate limit do Nominatim (~1 req/s).
    /// </summary>
    [HttpPost("geocodificar-pendentes")]
    [ProducesResponseType(typeof(EmpresaGeocodificarPendentesResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmpresaGeocodificarPendentesResponse>> GeocodificarPendentes(
        [FromServices] AppDbContext db,
        [FromServices] IGeocodingService geocoding,
        CancellationToken ct,
        [FromQuery] int take = 50)
    {
        take = Math.Clamp(take, 1, 200);

        var pendentes = await db.Empresas
            .Where(e => e.IsActive && e.Latitude == null && (e.Cidade != null || e.Cep != null))
            .OrderBy(e => e.Code)
            .Take(take)
            .ToListAsync(ct);

        var geocodificadas = 0;
        var falhas = 0;

        for (var i = 0; i < pendentes.Count; i++)
        {
            if (i > 0)
                await Task.Delay(NominatimMinIntervalMs, ct);

            var entity = pendentes[i];
            if (await TryGeocodificarEmpresaAsync(entity, geocoding, limparCoordsSeFalhar: false, ct))
            {
                entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                geocodificadas++;
            }
            else
            {
                falhas++;
            }
        }

        if (geocodificadas > 0)
            await db.SaveChangesAsync(ct);

        return Ok(new EmpresaGeocodificarPendentesResponse(pendentes.Count, geocodificadas, falhas));
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
