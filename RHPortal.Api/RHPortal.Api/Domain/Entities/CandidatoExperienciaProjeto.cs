namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoExperiencia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public string Empresa { get; set; } = string.Empty;
    public string Cargo { get; set; } = string.Empty;
    public string? Inicio { get; set; }
    public string? Fim { get; set; }
    public string? Local { get; set; }
    public string? Atividades { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CandidatoProjeto : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public string Nome { get; set; } = string.Empty;
    public string? Periodo { get; set; }
    public string? Descricao { get; set; }
    public string? Link { get; set; }
    public string? Stack { get; set; }
    public string? Destaques { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
