namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Resposta de um candidato a um campo personalizado de uma vaga.
/// Persistida no momento da candidatura via Portal público.
/// </summary>
public sealed class RespostaCampoPersonalizadoVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public Guid CampoId { get; set; }
    public CampoPersonalizadoVaga? Campo { get; set; }

    /// <summary>Valor informado pelo candidato (todos os tipos armazenados como texto).</summary>
    public string? ValorTexto { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
