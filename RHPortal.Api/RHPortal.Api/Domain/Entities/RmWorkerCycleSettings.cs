namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Configura singleton do intervalo entre ciclos do worker RM neste banco tenant.
/// Fonte da verdade no Portal; uma linha por banco (<see cref="SingletonRowId"/>).
/// </summary>
public sealed class RmWorkerCycleSettings : ITenantEntity
{
    /// <summary>Chave fixa — uma única linha por banco tenant.</summary>
    public static readonly Guid SingletonRowId = new("a1000001-0001-4000-8001-000000000001");

    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Intervalo em minutos entre ciclos completos (padrão 5).</summary>
    public int IntervalMinutes { get; set; } = 5;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
