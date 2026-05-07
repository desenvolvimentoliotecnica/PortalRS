using RhPortal.Api.Contracts.Owner;

namespace RhPortal.Api.Application.Owner;

public interface ITotvsGestorHierarchyOwnerService
{
    Task<TotvsGestorHierarchySettingsView?> GetSettingsAsync(string tenantId, CancellationToken ct);
    Task<TotvsGestorHierarchySettingsView> SaveSettingsAsync(TotvsGestorHierarchySettingsSaveRequest request, CancellationToken ct);
    Task<TotvsGestorHierarchyRunStartResponse> StartSyncAsync(string tenantId, CancellationToken ct);
    TotvsGestorHierarchyRunDto? GetRun(Guid runId);
    bool RequestCancel(Guid runId);
}
