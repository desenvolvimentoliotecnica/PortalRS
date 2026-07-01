using RhPortal.Api.Contracts.TenantOperationalReset;
using RhPortal.Api.Infrastructure.Ops;

namespace RhPortal.Api.Application.TenantOperationalReset;

public interface ITenantOperationalResetService
{
    Task<OperationalResetPreviewResponse> GetPreviewAsync(CancellationToken ct);

    Task<OperationalResetExecuteResponse> ExecuteAsync(
        IResetProgressReporter? progress,
        CancellationToken ct);
}
