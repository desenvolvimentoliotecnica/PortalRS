using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Auditing.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Auditing.Services;

public sealed class AuditWriter
{
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;

    public AuditWriter(IConfiguration config, IHostEnvironment env, IStringLocalizer<InfrastructureMessages> localizer)
    {
        _config = config;
        _env = env;
        _localizer = localizer;
    }

    public async Task<Guid> EnsureTransactionAsync(AuditContext context, CancellationToken ct)
    {
        var tenantId = NormalizeTenant(context.TenantId);
        var transactionId = context.TransactionId;

        await using var db = CreateDbContext(tenantId);

        var existing = await db.AuditTransactions
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TransactionId == transactionId, ct);

        if (existing is not null)
            return existing.Id;

        var entity = new AuditTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TransactionId = transactionId,
            CorrelationId = context.CorrelationId,
            TraceId = context.TraceId,
            SpanId = context.SpanId,
            ParentSpanId = context.ParentSpanId,
            Environment = context.Environment,
            AppVersion = context.AppVersion,
            StartedAt = context.StartedAt,
            Method = "N/A",
            Path = "/",
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.AuditTransactions.Add(entity);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            var fallback = await db.AuditTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.TransactionId == transactionId, ct);
            if (fallback is not null)
                return fallback.Id;
            throw;
        }

        return entity.Id;
    }

    public async Task WriteHttpAsync(AuditTransaction transaction, IEnumerable<AuditEvent> events, CancellationToken ct)
    {
        await using var db = CreateDbContext(transaction.TenantId);
        db.AuditTransactions.Update(transaction);
        db.AuditEvents.AddRange(events);
        await db.SaveChangesAsync(ct);
    }

    public async Task WriteDbAuditAsync(AuditEvent auditEvent, IReadOnlyList<AuditEntityChange> changes, IReadOnlyList<AuditEntityPropertyChange> properties, CancellationToken ct)
    {
        await using var db = CreateDbContext(auditEvent.TenantId);
        db.AuditEvents.Add(auditEvent);
        db.AuditEntityChanges.AddRange(changes);
        if (properties.Count > 0)
            db.AuditEntityPropertyChanges.AddRange(properties);
        await db.SaveChangesAsync(ct);
    }

    private AppDbContext CreateDbContext(string tenantId)
    {
        var conn = _config.GetConnectionString("Default")
            ?? throw new InvalidOperationException(_localizer["InfrastructureErrors.ConnectionStringDefaultRequired"]);
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(conn)
            .Options;
        var tenantContext = new TenantContext(_localizer);
        tenantContext.SetTenantId(tenantId);
        return new AppDbContext(options, tenantContext);
    }

    private string NormalizeTenant(string? tenantId)
        => string.IsNullOrWhiteSpace(tenantId) ? "system" : tenantId.Trim().ToLowerInvariant();
}
