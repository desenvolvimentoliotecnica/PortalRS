using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.Extensions.Options;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Inbox;

public sealed class InboxFolderWatcherService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly InboxFolderOptions _options;
    private readonly Channel<string> _queue;
    private readonly ConcurrentDictionary<string, byte> _seen = new();
    private FileSystemWatcher? _watcher;

    public InboxFolderWatcherService(IServiceScopeFactory scopeFactory, IOptions<InboxFolderOptions> options)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _queue = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true, SingleWriter = false });
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(_options.RootPath);
        StartWatcher();
        EnqueueExistingFiles();

        await foreach (var filePath in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            if (!TryGetTenantId(filePath, out var tenantId))
                continue;

            if (!await WaitForFileReadyAsync(filePath, stoppingToken))
                continue;

            using var scope = _scopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<InboxFileProcessor>();
            var options = scope.ServiceProvider.GetRequiredService<IOptions<InboxFolderOptions>>().Value;
            await processor.ProcessAsync(tenantId, filePath, options, InboxOrigem.Pasta, stoppingToken);
        }
    }

    private void StartWatcher()
    {
        _watcher = new FileSystemWatcher(_options.RootPath)
        {
            IncludeSubdirectories = true,
            EnableRaisingEvents = true
        };

        _watcher.Created += (_, e) => EnqueueFile(e.FullPath);
        _watcher.Renamed += (_, e) => EnqueueFile(e.FullPath);
    }

    private void EnqueueExistingFiles()
    {
        foreach (var file in Directory.EnumerateFiles(_options.RootPath, "*.*", SearchOption.AllDirectories))
        {
            EnqueueFile(file);
        }
    }

    private void EnqueueFile(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath))
            return;

        if (IsInSystemFolder(filePath))
            return;

        if (_seen.TryAdd(filePath, 0))
            _queue.Writer.TryWrite(filePath);
    }

    private bool IsInSystemFolder(string filePath)
    {
        var lowered = filePath.ToLowerInvariant();
        return lowered.Contains(Path.DirectorySeparatorChar + _options.ProcessedFolderName.ToLowerInvariant() + Path.DirectorySeparatorChar)
            || lowered.Contains(Path.DirectorySeparatorChar + _options.ErrorFolderName.ToLowerInvariant() + Path.DirectorySeparatorChar);
    }

    private bool TryGetTenantId(string filePath, out string tenantId)
    {
        tenantId = string.Empty;
        if (!filePath.StartsWith(_options.RootPath, StringComparison.OrdinalIgnoreCase))
            return false;

        var relative = filePath[_options.RootPath.Length..].TrimStart(Path.DirectorySeparatorChar);
        var parts = relative.Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return false;
        tenantId = parts[0];
        return !string.IsNullOrWhiteSpace(tenantId);
    }

    private async Task<bool> WaitForFileReadyAsync(string filePath, CancellationToken ct)
    {
        for (var attempt = 0; attempt < _options.RetryCount; attempt++)
        {
            try
            {
                await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                if (stream.Length > 0)
                    return true;
            }
            catch
            {
                // ignore and retry
            }

            await Task.Delay(_options.RetryDelayMs, ct);
        }

        return false;
    }
}
