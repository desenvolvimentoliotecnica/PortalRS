using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Auditing.Entities;
using RhPortal.Api.Auditing.Helpers;
using RhPortal.Api.Auditing.Services;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Auditing.EF;

public sealed class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly IAuditContextAccessor _accessor;
    private readonly AuditWriter _writer;
    private readonly ITenantContext _tenantContext;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AuditSaveChangesInterceptor> _logger;
    private static readonly ConcurrentDictionary<DbContext, List<PendingAuditEntry>> Pending = new();

    public AuditSaveChangesInterceptor(
        IAuditContextAccessor accessor,
        AuditWriter writer,
        ITenantContext tenantContext,
        IWebHostEnvironment env,
        ILogger<AuditSaveChangesInterceptor> logger)
    {
        _accessor = accessor;
        _writer = writer;
        _tenantContext = tenantContext;
        _env = env;
        _logger = logger;
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        CaptureEntries(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        CaptureEntries(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        PersistEntriesAsync(eventData.Context, CancellationToken.None).GetAwaiter().GetResult();
        return base.SavedChanges(eventData, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        await PersistEntriesAsync(eventData.Context, cancellationToken);
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    private void CaptureEntries(DbContext? context)
    {
        if (context is null || _accessor.SuppressAuditing) return;

        var entries = context.ChangeTracker
            .Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Where(e => !IsAuditEntity(e.Entity))
            .Where(e => !e.Metadata.IsOwned())
            .ToList();

        if (entries.Count == 0) return;

        var pending = new List<PendingAuditEntry>();

        foreach (var entry in entries)
        {
            var state = entry.State;
            var entityName = entry.Metadata.ClrType.Name;
            var tableName = entry.Metadata.GetTableName();

            string? deleteSource = null;
            var beforeValues = state switch
            {
                EntityState.Added => null,
                EntityState.Deleted => CaptureOriginalValues(entry, out deleteSource),
                EntityState.Modified => CaptureOriginalValues(entry, out _),
                _ => null
            };

            var afterValues = state switch
            {
                EntityState.Added => CaptureCurrentValues(entry),
                EntityState.Modified => CaptureCurrentValues(entry),
                _ => null
            };

            var changedColumns = state == EntityState.Modified
                ? string.Join(",", entry.Properties.Where(p => p.IsModified).Select(p => p.Metadata.Name))
                : null;

            var propertyChanges = state == EntityState.Modified
                ? BuildPropertyChanges(entry)
                : [];

            pending.Add(new PendingAuditEntry
            {
                Entry = entry,
                EntityName = entityName,
                TableName = tableName,
                State = state.ToString(),
                BeforeJson = beforeValues,
                AfterJson = afterValues,
                ChangedColumns = changedColumns,
                DataJson = state == EntityState.Deleted && !string.IsNullOrWhiteSpace(deleteSource)
                    ? $"{{\"deleteSnapshotSource\":\"{deleteSource}\"}}"
                    : null,
                PropertyChanges = propertyChanges
            });
        }

        if (pending.Count > 0)
        {
            Pending[context] = pending;
        }
    }

    private async Task PersistEntriesAsync(DbContext? context, CancellationToken ct)
    {
        if (context is null || _accessor.SuppressAuditing) return;
        if (!Pending.TryRemove(context, out var pending) || pending.Count == 0) return;

        IDisposable? scope = null;
        try
        {
            if (_accessor.Current is null)
                scope = _accessor.BeginScope(CreateSystemContext());

            var auditContext = _accessor.Current ?? CreateSystemContext();
            var tenantId = string.IsNullOrWhiteSpace(auditContext.TenantId) ? "system" : auditContext.TenantId;
            var transactionId = await _writer.EnsureTransactionAsync(auditContext, ct);
            auditContext.AuditTransactionId = transactionId;

            var order = _accessor.NextOrder();
            var auditEvent = new AuditEvent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                AuditTransactionId = transactionId,
                Order = order,
                EventType = "DB",
                Name = "SaveChanges",
                OccurredAt = DateTimeOffset.UtcNow,
                DataJson = null,
                CreatedAt = DateTimeOffset.UtcNow
            };

            var changes = new List<AuditEntityChange>();
            var properties = new List<AuditEntityPropertyChange>();

            foreach (var item in pending)
            {
                var pkJson = BuildPrimaryKeyJson(item.Entry);
                var changeId = Guid.NewGuid();

                changes.Add(new AuditEntityChange
                {
                    Id = changeId,
                    TenantId = tenantId,
                    AuditTransactionId = transactionId,
                    AuditEventId = auditEvent.Id,
                    Order = order,
                    EntityName = item.EntityName,
                    TableName = item.TableName,
                    State = item.State,
                    PrimaryKeyJson = pkJson,
                    BeforeJson = item.BeforeJson,
                    AfterJson = item.AfterJson,
                    ChangedColumns = item.ChangedColumns,
                    DataJson = item.DataJson,
                    OccurredAt = DateTimeOffset.UtcNow,
                    CreatedAt = DateTimeOffset.UtcNow
                });

                foreach (var prop in item.PropertyChanges)
                {
                    properties.Add(new AuditEntityPropertyChange
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        AuditEntityChangeId = changeId,
                        PropertyName = prop.PropertyName,
                        BeforeValue = prop.BeforeValue,
                        AfterValue = prop.AfterValue,
                        IsSensitive = prop.IsSensitive,
                        CreatedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            await _writer.WriteDbAuditAsync(auditEvent, changes, properties, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Audit interceptor failed to persist logs.");
        }
        finally
        {
            scope?.Dispose();
        }
    }

    private static string BuildPrimaryKeyJson(EntityEntry entry)
    {
        var dict = new Dictionary<string, object?>();
        foreach (var prop in entry.Properties.Where(p => p.Metadata.IsPrimaryKey()))
        {
            dict[prop.Metadata.Name] = prop.CurrentValue ?? prop.OriginalValue;
        }
        return AuditValueFormatter.SerializeDictionary(dict);
    }

    private static string? CaptureCurrentValues(EntityEntry entry)
    {
        var dict = new Dictionary<string, object?>();
        foreach (var prop in entry.Properties)
        {
            if (prop.Metadata.IsShadowProperty()) continue;
            dict[prop.Metadata.Name] = AuditJsonMasker.IsSensitive(prop.Metadata.Name) ? "***" : prop.CurrentValue;
        }
        return AuditValueFormatter.SerializeDictionary(dict);
    }

    private static string? CaptureOriginalValues(EntityEntry entry, out string source)
    {
        var dict = new Dictionary<string, object?>();
        source = "original";

        foreach (var prop in entry.Properties)
        {
            if (prop.Metadata.IsShadowProperty()) continue;
            var value = prop.OriginalValue ?? prop.CurrentValue;
            if (prop.OriginalValue is null && prop.CurrentValue is not null)
                source = "current";
            dict[prop.Metadata.Name] = AuditJsonMasker.IsSensitive(prop.Metadata.Name) ? "***" : value;
        }
        return AuditValueFormatter.SerializeDictionary(dict);
    }

    private static List<PropertyChange> BuildPropertyChanges(EntityEntry entry)
    {
        var changes = new List<PropertyChange>();
        foreach (var prop in entry.Properties)
        {
            if (!prop.IsModified) continue;
            if (prop.Metadata.IsShadowProperty()) continue;

            var isSensitive = AuditJsonMasker.IsSensitive(prop.Metadata.Name);
            changes.Add(new PropertyChange
            {
                PropertyName = prop.Metadata.Name,
                BeforeValue = AuditValueFormatter.FormatValue(prop.OriginalValue, isSensitive),
                AfterValue = AuditValueFormatter.FormatValue(prop.CurrentValue, isSensitive),
                IsSensitive = isSensitive
            });
        }
        return changes;
    }

    private static bool IsAuditEntity(object entity)
        => entity is AuditTransaction or AuditEvent or AuditEntityChange or AuditEntityPropertyChange;

    private AuditContext CreateSystemContext()
        => new()
        {
            TenantId = string.IsNullOrWhiteSpace(_tenantContext.TenantId) ? "system" : _tenantContext.TenantId,
            TransactionId = Guid.NewGuid().ToString("N"),
            Environment = "system",
            AppVersion = typeof(AuditSaveChangesInterceptor).Assembly.GetName().Version?.ToString() ?? "unknown",
            StartedAt = DateTimeOffset.UtcNow
        };

    private sealed class PendingAuditEntry
    {
        public EntityEntry Entry { get; init; } = default!;
        public string EntityName { get; init; } = default!;
        public string? TableName { get; init; }
        public string State { get; init; } = default!;
        public string? BeforeJson { get; init; }
        public string? AfterJson { get; init; }
        public string? ChangedColumns { get; init; }
        public string? DataJson { get; init; }
        public List<PropertyChange> PropertyChanges { get; init; } = [];
    }

    private sealed class PropertyChange
    {
        public string PropertyName { get; init; } = default!;
        public string? BeforeValue { get; init; }
        public string? AfterValue { get; init; }
        public bool IsSensitive { get; init; }
    }
}
