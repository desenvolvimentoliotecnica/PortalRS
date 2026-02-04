using Microsoft.AspNetCore.SignalR;

namespace RhPortal.Api.Infrastructure.Ops;

public interface IResetProgressReporter
{
    Task ReportAsync(ResetProgressMessage message, CancellationToken ct);
}

public sealed class SignalRResetProgressReporter : IResetProgressReporter
{
    private readonly IHubContext<ResetProgressHub> _hub;
    private readonly string _connectionId;

    public SignalRResetProgressReporter(IHubContext<ResetProgressHub> hub, string connectionId)
    {
        _hub = hub;
        _connectionId = connectionId;
    }

    public Task ReportAsync(ResetProgressMessage message, CancellationToken ct)
    {
        return _hub.Clients.Client(_connectionId).SendAsync("resetProgress", message, ct);
    }
}
