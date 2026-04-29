using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.IntegracaoTotvs;

/// <summary>
/// Auditoria de execução do worker RM. Cada entidade RM (PFUNC, VRSVAGAS, VHIERARQUIA, etc.)
/// gera 1 registro <c>RmSyncRun</c> por ciclo: <c>StartAsync</c> ao começar, <c>FinishAsync</c> ao terminar.
/// Sustenta a aba "Sincronização RM" dentro de <c>/Owner/Integracao</c>.
/// </summary>
public interface IRmSyncRunService
{
    /// <summary>Cria run com status InProgress no tenant atual e devolve o Id.</summary>
    Task<Guid> StartAsync(StartRmSyncRunRequest request, CancellationToken ct);

    /// <summary>Atualiza run existente com counters + status final + watermark capturado.</summary>
    Task FinishAsync(Guid id, FinishRmSyncRunRequest request, CancellationToken ct);

    /// <summary>Lista cross-tenant para o painel Owner. Filtros opcionais e limit no número de linhas.</summary>
    Task<IReadOnlyList<OwnerPainelSyncRmRow>> OwnerListAsync(
        string? tenantId,
        string? entidade,
        RmSyncStatus? status,
        DateTimeOffset? desde,
        int limit,
        CancellationToken ct);

    /// <summary>Lê watermark vigente da entidade no tenant atual. Cria registro vazio na primeira chamada.</summary>
    Task<RmSyncCheckpointResponse> GetCheckpointAsync(string entidade, CancellationToken ct);

    /// <summary>Persiste o novo watermark após sync bem-sucedido. Upsert por <c>(TenantId, Entidade)</c>.</summary>
    Task UpdateCheckpointAsync(UpdateRmSyncCheckpointRequest request, CancellationToken ct);

    /// <summary>Reseta watermark de uma entidade (volta a null) — força full no próximo ciclo. Usado pelo CLI <c>sync --full</c>.</summary>
    Task ResetCheckpointAsync(string entidade, CancellationToken ct);

    /// <summary>Reseta TODOS os checkpoints do tenant atual.</summary>
    Task ResetAllCheckpointsAsync(CancellationToken ct);

    // ── Alertas (Frente C) ──

    /// <summary>Lista cross-tenant de alertas de zumbi para a tela Owner.</summary>
    Task<IReadOnlyList<OwnerPainelAlertaRmRow>> OwnerListAlertasAsync(
        string? tenantId,
        bool incluirResolvidos,
        int limit,
        CancellationToken ct);

    /// <summary>Resolve manualmente um alerta (Owner ação).</summary>
    Task ResolverAlertaAsync(Guid alertaId, ResolverAlertaRequest request, CancellationToken ct);

    /// <summary>
    /// Dispara um ciclo do worker em background via Process.Start (apenas dev/on-prem).
    /// Retorna o PID se conseguiu iniciar; null se já há outro ciclo manual rodando.
    /// </summary>
    Task<int?> TriggerRunNowAsync(CancellationToken ct);

    /// <summary>Solicita interrupção cooperativa do ciclo RM em execução.</summary>
    Task<OwnerRmSyncCancelResponse> RequestCancelAsync(CancellationToken ct);
}
