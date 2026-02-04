using System.Threading;

namespace RhPortal.Api.Infrastructure.Data;

public sealed class ResetState
{
    private int _isResetting;

    public bool IsResetting => Interlocked.CompareExchange(ref _isResetting, 0, 0) == 1;

    public void SetResetting(bool value)
    {
        Interlocked.Exchange(ref _isResetting, value ? 1 : 0);
    }
}
