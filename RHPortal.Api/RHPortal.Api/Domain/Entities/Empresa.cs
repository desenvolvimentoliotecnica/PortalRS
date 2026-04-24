using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Empresa (CNPJ/razão social) — dimensão raiz do tenant. Estende-se em 31.8 com
/// endereço completo + coordenadas geocodificadas (latitude/longitude) para
/// alimentar o cálculo de distância candidato × empresa no MatchingService.
/// </summary>
public sealed class Empresa : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [MaxLength(30)]
    public string Code { get; set; } = default!;        // Código único por tenant

    [MaxLength(120)]
    public string Description { get; set; } = default!;

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    // ── Endereço (Sessão 31.8 — usado em matching por distância) ──────────

    [MaxLength(20)]
    public string? Cep { get; set; }

    [MaxLength(200)]
    public string? Logradouro { get; set; }

    [MaxLength(40)]
    public string? Numero { get; set; }

    [MaxLength(120)]
    public string? Bairro { get; set; }

    [MaxLength(120)]
    public string? Cidade { get; set; }

    [MaxLength(2)]
    public string? Uf { get; set; }

    /// <summary>
    /// Latitude geocodificada (graus decimais, WGS84). Cache do resultado de
    /// `IGeocodingService.GeocodeAsync` para evitar chamada externa repetida.
    /// Recalculada quando endereço muda. Precisão decimal(9,6) cobre ~10cm.
    /// </summary>
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude geocodificada. Veja nota em <see cref="Latitude"/>.
    /// Precisão decimal(9,6).
    /// </summary>
    public decimal? Longitude { get; set; }

    /// <summary>Quando a geocodificação foi computada pela última vez. Null = nunca.</summary>
    public DateTimeOffset? GeocodificadoEmUtc { get; set; }
}
