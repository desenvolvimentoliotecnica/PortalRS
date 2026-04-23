using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Registro imutável de cada transição de status em qualquer entidade do sistema.
/// Armazena o tempo gasto no status anterior e se o SLA configurado foi respeitado.
/// </summary>
public sealed class HistoricoStatus : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Polimorfismo ──

    public TipoEntidadeStatus TipoEntidade { get; set; }
    public Guid EntidadeId { get; set; }

    // ── Transição ──

    [StringLength(80)]
    public string StatusAnterior { get; set; } = default!;

    [StringLength(80)]
    public string StatusNovo { get; set; } = default!;

    // ── Quem mudou ──

    public Guid? AlteradoPorFuncionarioId { get; set; }
    public Guid? AlteradoPorUserId { get; set; }

    [StringLength(200)]
    public string AlteradoPorNome { get; set; } = default!;

    // ── Quando mudou ──

    public DateTimeOffset AlteradoEmUtc { get; set; }

    // ── SLA ──

    /// <summary>Snapshot do SLA configurado para o status anterior no momento da transição (horas).</summary>
    public int? SlaEsperadoHoras { get; set; }

    /// <summary>Tempo que a entidade ficou no status anterior (calculado ao sair dele).</summary>
    public double? TempoNoStatusAnteriorHoras { get; set; }

    /// <summary>True se TempoNoStatusAnteriorHoras <= SlaEsperadoHoras. Null se SLA não configurado.</summary>
    public bool? DentroDoSla { get; set; }

    // ── Contexto ──

    [StringLength(1000)]
    public string? Observacao { get; set; }
}
