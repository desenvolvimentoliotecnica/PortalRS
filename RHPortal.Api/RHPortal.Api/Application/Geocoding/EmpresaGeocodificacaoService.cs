using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Empresa;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Geocodificação de <see cref="Empresa"/> — usado no CRUD, backfill de startup e pós-sync RM.
/// </summary>
public sealed class EmpresaGeocodificacaoService
{
    public const int NominatimMinIntervalMs = 1100;

    private readonly IGeocodingService _geocoding;
    private readonly ILogger<EmpresaGeocodificacaoService> _logger;

    public EmpresaGeocodificacaoService(IGeocodingService geocoding, ILogger<EmpresaGeocodificacaoService> logger)
    {
        _geocoding = geocoding;
        _logger = logger;
    }

    public async Task ApplyEnderecoEGeocodificarAsync(
        Empresa entity,
        string? cep,
        string? logradouro,
        string? numero,
        string? bairro,
        string? cidade,
        string? uf,
        bool preserveExistingAddressWhenNull,
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

        await TryGeocodificarAsync(entity, limparCoordsSeFalhar: enderecoMudou, ct);
    }

    public async Task<bool> TryGeocodificarAsync(
        Empresa entity,
        bool limparCoordsSeFalhar,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(entity.Cep) && string.IsNullOrWhiteSpace(entity.Cidade))
            return false;

        var result = await _geocoding.GeocodeAsync(
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

    public async Task<EmpresaGeocodificarPendentesResponse> GeocodificarPendentesAsync(
        AppDbContext db,
        int take,
        CancellationToken ct)
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
            if (await TryGeocodificarAsync(entity, limparCoordsSeFalhar: false, ct))
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

        if (geocodificadas > 0 || falhas > 0)
        {
            _logger.LogInformation(
                "Geocodificação pendentes: total={Total}, ok={Ok}, falhas={Falhas}",
                pendentes.Count, geocodificadas, falhas);
        }

        return new EmpresaGeocodificarPendentesResponse(pendentes.Count, geocodificadas, falhas);
    }

    private static string? CoalesceAddressField(string? incoming, string? existing, bool preserveWhenNull)
    {
        var parsed = NullIfBlank(incoming);
        if (parsed is not null)
            return parsed;
        return preserveWhenNull ? NullIfBlank(existing) : null;
    }

    private static string? NullIfBlank(string? s)
        => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
