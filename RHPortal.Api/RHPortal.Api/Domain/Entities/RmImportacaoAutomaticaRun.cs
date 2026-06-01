namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Histórico auditável dos ciclos automáticos que importam requisições RM para o Portal.
/// Mantido por 60 dias para consulta operacional e download de log.
/// </summary>
public sealed class RmImportacaoAutomaticaRun : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? FinishedAtUtc { get; set; }

    public string Status { get; set; } = "EmExecucao";
    public int IntervalMinutes { get; set; }
    public int MaxPerRun { get; set; }

    public int TotalLidos { get; set; }
    public int Criados { get; set; }
    public int Atualizados { get; set; }
    public int VagasCriadas { get; set; }
    public int Ignorados { get; set; }
    public int Erros { get; set; }

    public int StatusSyncTotalLidos { get; set; }
    public int StatusSyncAtualizados { get; set; }
    public int StatusSyncIgnorados { get; set; }
    public int StatusSyncErros { get; set; }

    public string? Mensagem { get; set; }
    public string LogText { get; set; } = string.Empty;
}
