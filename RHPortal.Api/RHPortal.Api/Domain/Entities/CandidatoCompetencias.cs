using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoCompetencia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [Required, StringLength(40)]
    public string Tipo { get; set; } = string.Empty;

    [Required, StringLength(120)]
    public string Nome { get; set; } = string.Empty;

    [Required, StringLength(40)]
    public string Nivel { get; set; } = string.Empty;

    [StringLength(300)]
    public string? Evidencia { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CandidatoCertificacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [Required, StringLength(160)]
    public string Nome { get; set; } = string.Empty;

    [StringLength(160)]
    public string? Instituicao { get; set; }

    [StringLength(10)]
    public string? Ano { get; set; }

    [StringLength(260)]
    public string? Link { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CandidatoPortfolio : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [StringLength(40)]
    public string? WorkModel { get; set; }

    [StringLength(40)]
    public string? Availability { get; set; }

    [StringLength(40)]
    public string? Salary { get; set; }

    [StringLength(40)]
    public string? Shift { get; set; }

    [StringLength(200)]
    public string? Note { get; set; }

    [StringLength(260)]
    public string? Linkedin { get; set; }

    [StringLength(260)]
    public string? Github { get; set; }

    [StringLength(260)]
    public string? Portfolio { get; set; }

    [StringLength(260)]
    public string? Drive { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
