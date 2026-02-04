using Microsoft.EntityFrameworkCore;
using Npgsql;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Messaging.Email;

public sealed class EmailDispatchWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailDispatchWorker> _logger;

    public EmailDispatchWorker(IServiceScopeFactory scopeFactory, ILogger<EmailDispatchWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break; // Graceful shutdown
            }
            catch (ObjectDisposedException)
            {
                break; // Host shutting down or failed to start (e.g. port in use)
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Email dispatch worker failed.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break; // Graceful shutdown
            }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        List<string> tenantIds;
        using (var masterScope = _scopeFactory.CreateScope())
        {
            var masterDb = masterScope.ServiceProvider.GetRequiredService<MasterDbContext>();
            tenantIds = await masterDb.Tenants
                .AsNoTracking()
                .Where(t => t.IsActive)
                .Select(t => t.TenantId)
                .ToListAsync(ct);
        }

        var now = DateTimeOffset.UtcNow;
        foreach (var tenantId in tenantIds)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
                tenantContext.SetTenantId(tenantId);
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var sender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
                var configService = scope.ServiceProvider.GetRequiredService<IEmailConfigService>();

                var pending = await db.EmailMessages
                    .Where(x => (x.Status == EmailMessageStatus.Queued || x.Status == EmailMessageStatus.Failed)
                                && x.AttemptCount < x.MaxAttempts
                                && (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now))
                    .OrderBy(x => x.CreatedAtUtc)
                    .Take(20)
                    .ToListAsync(ct);

                var config = await configService.GetAsync(ct);
                var providerName = string.IsNullOrWhiteSpace(config?.Provider) ? "smtp" : config.Provider.Trim().ToLowerInvariant();
                foreach (var msg in pending)
                    await SendOneAsync(db, sender, msg, providerName, ct);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                // relation does not exist: tenant DB may not have migrations applied yet
                _logger.LogWarning("Tenant {TenantId}: schema missing (EmailMessages). Run migrations for this tenant.", tenantId);
            }
        }
    }

    private async Task SendOneAsync(AppDbContext db, IEmailSender sender, EmailMessage msg, string providerName, CancellationToken ct)
    {
        msg.Status = EmailMessageStatus.InProgress;
        msg.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var attempt = new EmailAttempt
        {
            Id = Guid.NewGuid(),
            TenantId = msg.TenantId,
            EmailMessageId = msg.Id,
            AttemptNumber = msg.AttemptCount + 1,
            Provider = providerName,
            StartedAtUtc = DateTimeOffset.UtcNow
        };

        db.EmailAttempts.Add(attempt);
        await db.SaveChangesAsync(ct);

        try
        {
            await sender.SendAsync(new EmailSendRequest(
                msg.To,
                msg.Subject,
                msg.BodyHtml,
                msg.BodyText,
                providerName), ct);

            attempt.IsSuccess = true;
            attempt.CompletedAtUtc = DateTimeOffset.UtcNow;

            msg.AttemptCount++;
            msg.Status = EmailMessageStatus.Sent;
            msg.LastError = null;
            msg.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
        catch (Exception ex)
        {
            attempt.IsSuccess = false;
            attempt.CompletedAtUtc = DateTimeOffset.UtcNow;
            attempt.ErrorMessage = ex.Message;
            attempt.ErrorStackTrace = ex.StackTrace;

            msg.AttemptCount++;
            msg.LastError = ex.Message;

            if (msg.AttemptCount >= msg.MaxAttempts)
            {
                msg.Status = EmailMessageStatus.Failed;
                msg.NextAttemptAtUtc = null;
            }
            else
            {
                msg.Status = EmailMessageStatus.Queued;
                msg.NextAttemptAtUtc = DateTimeOffset.UtcNow.AddMinutes(5);
            }

            msg.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }
}
