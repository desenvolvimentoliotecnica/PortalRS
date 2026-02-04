namespace RhPortal.Api.Auditing.Context;

public sealed class AuditContextAccessor : IAuditContextAccessor
{
    private static readonly AsyncLocal<AuditContextHolder> Holder = new();

    private sealed class AuditContextHolder
    {
        public AuditContext? Context;
        public bool Suppress;
    }

    public AuditContext? Current
    {
        get => Holder.Value?.Context;
        set
        {
            var holder = Holder.Value ?? new AuditContextHolder();
            holder.Context = value;
            Holder.Value = holder;
        }
    }

    public bool SuppressAuditing
    {
        get => Holder.Value?.Suppress ?? false;
        set
        {
            var holder = Holder.Value ?? new AuditContextHolder();
            holder.Suppress = value;
            Holder.Value = holder;
        }
    }

    public int NextOrder()
        => Current?.NextOrder() ?? 0;

    public IDisposable BeginScope(AuditContext context)
    {
        var previous = Current;
        Current = context;
        return new ScopeDisposable(() => Current = previous);
    }

    public IDisposable BeginSuppress()
    {
        var previous = SuppressAuditing;
        SuppressAuditing = true;
        return new ScopeDisposable(() => SuppressAuditing = previous);
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
