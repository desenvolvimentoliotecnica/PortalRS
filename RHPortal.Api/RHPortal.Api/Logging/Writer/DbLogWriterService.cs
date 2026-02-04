using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Logging.Context;
using RhPortal.Api.Logging.Entities;
using RhPortal.Api.Logging.Logger;

namespace RhPortal.Api.Logging.Writer;

public sealed class DbLogWriterService : BackgroundService
{
    private readonly ChannelReader<LogEntryEnvelope> _reader;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogContextAccessor _accessor;
    private readonly ILogger<DbLogWriterService> _logger;

    public DbLogWriterService(
        Channel<LogEntryEnvelope> channel,
        IServiceScopeFactory scopeFactory,
        ILogContextAccessor accessor,
        ILogger<DbLogWriterService> logger)
    {
        _reader = channel.Reader;
        _scopeFactory = scopeFactory;
        _accessor = accessor;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var buffer = new List<LogEntry>(200);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                while (await _reader.WaitToReadAsync(stoppingToken))
                {
                    while (_reader.TryRead(out var envelope))
                    {
                        buffer.Add(envelope.Entry);
                        if (buffer.Count >= 200)
                            break;
                    }

                    if (buffer.Count > 0)
                    {
                        await PersistBatchAsync(buffer, stoppingToken);
                        buffer.Clear();
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DbLogWriterService failed.");
                await Task.Delay(500, stoppingToken);
            }
        }
    }

    private async Task PersistBatchAsync(List<LogEntry> entries, CancellationToken ct)
    {
        using var suppress = _accessor.BeginSuppress();

        foreach (var group in entries.GroupBy(x => x.TenantId))
        {
            using var scope = _scopeFactory.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(group.Key);
            var auditAccessor = scope.ServiceProvider.GetRequiredService<IAuditContextAccessor>();
            using var auditSuppress = auditAccessor.BeginSuppress();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            db.LogEntries.AddRange(group);
            await db.SaveChangesAsync(ct);
        }
    }
}
