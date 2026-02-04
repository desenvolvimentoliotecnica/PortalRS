using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Unit : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Code { get; set; } = default!;      // UNI-XXX
    public string Name { get; set; } = default!;      // "Embu das Artes - SP"

    public UnitStatus Status { get; set; } = UnitStatus.Active;

    public string? City { get; set; }                 // "Embu das Artes"
    public string? Uf { get; set; }                   // "SP"

    public string? AddressLine { get; set; }          // "Rua, numero, complemento"
    public string? Neighborhood { get; set; }         // "Industrial"
    public string? ZipCode { get; set; }              // "00000-000"

    public string? Email { get; set; }                // unidade@...
    public string? Phone { get; set; }                // (11) 4000-0000

    public string? ResponsibleName { get; set; }      // Nome do responsável
    public string? Type { get; set; }                 // "Industria / CD / Escritório"

    public int Headcount { get; set; }                // 0..n
    public string? Notes { get; set; }                // Observação

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
