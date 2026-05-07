using System.Collections.Concurrent;
using RhPortal.Api.Contracts.Owner;

namespace RhPortal.Api.Application.Owner;

public sealed class TotvsGestorHierarchyRunHandle
{
    private readonly object _lock = new();
    private readonly List<string> _lines = new();
    private const int MaxLines = 4000;

    public Guid RunId { get; init; }
    public string TenantId { get; init; } = default!;
    public CancellationTokenSource Cancellation { get; } = new();
    public DateTimeOffset StartedAtUtc { get; } = DateTimeOffset.UtcNow;

    public TotvsGestorHierarchyRunUiStatus Status { get; private set; } = TotvsGestorHierarchyRunUiStatus.Running;
    public DateTimeOffset? EndedAtUtc { get; private set; }
    public string? ErrorMessage { get; private set; }

    public int ProgressCurrent { get; private set; }
    public int ProgressTotal { get; private set; }

    public void SetTotal(int total)
    {
        lock (_lock) ProgressTotal = Math.Max(0, total);
    }

    public void Tick(int current)
    {
        lock (_lock) ProgressCurrent = current;
    }

    public void AddLine(string line)
    {
        var ts = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.fff");
        var full = $"{ts} {line}";
        lock (_lock)
        {
            _lines.Add(full);
            while (_lines.Count > MaxLines)
                _lines.RemoveAt(0);
        }
    }

    public IReadOnlyList<string> GetLogTail(int max = 600)
    {
        lock (_lock)
        {
            if (_lines.Count <= max)
                return _lines.ToArray();
            return _lines.Skip(_lines.Count - max).ToArray();
        }
    }

    public void CompleteSuccess()
    {
        lock (_lock)
        {
            if (Status != TotvsGestorHierarchyRunUiStatus.Running)
                return;
            Status = TotvsGestorHierarchyRunUiStatus.Completed;
            EndedAtUtc = DateTimeOffset.UtcNow;
        }
    }

    public void CompleteFailed(string msg)
    {
        lock (_lock)
        {
            if (Status != TotvsGestorHierarchyRunUiStatus.Running)
                return;
            Status = TotvsGestorHierarchyRunUiStatus.Failed;
            ErrorMessage = msg;
            EndedAtUtc = DateTimeOffset.UtcNow;
        }
    }

    public void CompleteCancelled()
    {
        lock (_lock)
        {
            if (Status != TotvsGestorHierarchyRunUiStatus.Running)
                return;
            Status = TotvsGestorHierarchyRunUiStatus.Cancelled;
            EndedAtUtc = DateTimeOffset.UtcNow;
        }
    }
}

public sealed class TotvsGestorHierarchyRunRegistry
{
    private readonly ConcurrentDictionary<Guid, TotvsGestorHierarchyRunHandle> _runs = new();

    public TotvsGestorHierarchyRunHandle Register(string tenantId)
    {
        var h = new TotvsGestorHierarchyRunHandle
        {
            RunId = Guid.NewGuid(),
            TenantId = tenantId,
        };
        if (!_runs.TryAdd(h.RunId, h))
            throw new InvalidOperationException("Falha ao registrar execução.");
        return h;
    }

    public bool TryGet(Guid id, out TotvsGestorHierarchyRunHandle? handle) =>
        _runs.TryGetValue(id, out handle);

    /// <summary>Cancela e remove do registro após um tempo (evita vazamento).</summary>
    public void ForgetAfter(Guid id, TimeSpan delay)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(delay).ConfigureAwait(false);
                _runs.TryRemove(id, out _);
            }
            catch
            {
                /* ignore */
            }
        });
    }
}
