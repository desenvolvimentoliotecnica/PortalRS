using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoAgendaPreferencia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [StringLength(40)]
    public string? FormatoEntrevista { get; set; }

    [StringLength(40)]
    public string? InicioDisponivel { get; set; }

    [StringLength(40)]
    public string? AvisoPrevio { get; set; }

    [StringLength(400)]
    public string? Observacoes { get; set; }

    public bool DiaSeg { get; set; }
    public bool DiaTer { get; set; }
    public bool DiaQua { get; set; }
    public bool DiaQui { get; set; }
    public bool DiaSex { get; set; }
    public bool DiaSab { get; set; }
    public bool DiaDom { get; set; }

    public bool PeriodoManha { get; set; }
    public bool PeriodoTarde { get; set; }
    public bool PeriodoNoite { get; set; }

    [StringLength(40)]
    public string? HorarioPreferido { get; set; }

    [StringLength(60)]
    public string? FusoHorario { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CandidatoAgendaBloqueio : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [StringLength(40)]
    public string? Tipo { get; set; }

    [StringLength(120)]
    public string? Titulo { get; set; }

    [StringLength(40)]
    public string? Data { get; set; }

    [StringLength(40)]
    public string? Horario { get; set; }

    [StringLength(400)]
    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
