namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Resultado de uma geocodificação: coordenadas WGS84 + endereço formatado pelo
/// provedor (útil pra debug/auditoria).
/// </summary>
public sealed record GeocodeResult(decimal Latitude, decimal Longitude, string? DisplayName);

/// <summary>
/// Serviço de geocodificação — converte endereço (CEP, rua, cidade, UF) em
/// coordenadas (lat/lng).
///
/// <para>Implementação atual: Nominatim (OpenStreetMap free). Limites de uso:
/// 1 req/s, User-Agent obrigatório.</para>
///
/// <para>O serviço é <b>best-effort</b>: se a chamada externa falhar (timeout,
/// rate limit, endereço inválido), retorna <c>null</c> e o consumidor deixa
/// Latitude/Longitude da entidade como null — o MatchingService trata isso
/// graciosamente (score de Localidade vira parcial).</para>
/// </summary>
public interface IGeocodingService
{
    /// <summary>
    /// Geocodifica um endereço. Pelo menos cidade+UF deve estar preenchido para
    /// retornar resultado útil; CEP melhora muito a precisão.
    /// </summary>
    /// <returns><c>GeocodeResult</c> ou <c>null</c> se não foi possível geocodificar.</returns>
    Task<GeocodeResult?> GeocodeAsync(
        string? cep,
        string? logradouro,
        string? numero,
        string? cidade,
        string? uf,
        CancellationToken ct);
}
