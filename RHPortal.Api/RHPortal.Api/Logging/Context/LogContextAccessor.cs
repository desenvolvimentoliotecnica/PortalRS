namespace RhPortal.Api.Logging.Context;

public sealed class LogContextAccessor : ILogContextAccessor
{
    private static readonly AsyncLocal<ContextHolder> Holder = new();

    private sealed class ContextHolder
    {
        public LogContext? Context;
        public bool Suppress;
    }

    public LogContext? Current
    {
        get => Holder.Value?.Context;
        set
        {
            var holder = Holder.Value ?? new ContextHolder();
            holder.Context = value;
            Holder.Value = holder;
        }
    }

    public bool SuppressLogging
    {
        get => Holder.Value?.Suppress ?? false;
        set
        {
            var holder = Holder.Value ?? new ContextHolder();
            holder.Suppress = value;
            Holder.Value = holder;
        }
    }

    public int NextOrder() => Current?.NextOrder() ?? 0;
    public void IncrementError() => Current?.IncrementError();
    public void IncrementWarning() => Current?.IncrementWarning();

    public IDisposable BeginScope(LogContext context)
    {
        var previous = Current;
        Current = context;
        return new ScopeDisposable(() => Current = previous);
    }

    public IDisposable BeginSuppress()
    {
        var previous = SuppressLogging;
        SuppressLogging = true;
        return new ScopeDisposable(() => SuppressLogging = previous);
    }

    private sealed class ScopeDisposable : IDisposable
    {
        private readonly Action _onDispose;
        private bool _disposed;

        public ScopeDisposable(Action onDispose) => _onDispose = onDispose;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _onDispose();
        }
    }
}
