using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Empresa;

public sealed record EmpresaCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(20)] string? Cep,
    [MaxLength(200)] string? Logradouro,
    [MaxLength(40)] string? Numero,
    [MaxLength(120)] string? Bairro,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    bool IsActive = true
);

public sealed record EmpresaUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(20)] string? Cep,
    [MaxLength(200)] string? Logradouro,
    [MaxLength(40)] string? Numero,
    [MaxLength(120)] string? Bairro,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    bool IsActive
);

public sealed record EmpresaResponse(
    Guid Id,
    string Code,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Bairro,
    string? Cidade,
    string? Uf,
    /// <summary>Latitude geocodificada (cache). Null = ainda não geocodificada ou falhou.</summary>
    decimal? Latitude,
    /// <summary>Longitude geocodificada (cache).</summary>
    decimal? Longitude,
    DateTimeOffset? GeocodificadoEmUtc
);

public sealed record EmpresaLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);
