using Microsoft.EntityFrameworkCore;
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Email dispatch worker failed.");
            }

            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var configService = scope.ServiceProvider.GetRequiredService<IEmailConfigService>();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();

        var now = DateTimeOffset.UtcNow;
        var pending = await db.EmailMessages
            .IgnoreQueryFilters()
            .Where(x => (x.Status == EmailMessageStatus.Queued || x.Status == EmailMessageStatus.Failed)
                        && x.AttemptCount < x.MaxAttempts
                        && (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now))
            .OrderBy(x => x.CreatedAtUtc)
            .Take(20)
            .ToListAsync(ct);

        foreach (var msg in pending)
        {
            tenantContext.SetTenantId(msg.TenantId);
            var config = await configService.GetAsync(ct);
            var providerName = string.IsNullOrWhiteSpace(config?.Provider) ? "smtp" : config.Provider.Trim().ToLowerInvariant();
            await SendOneAsync(db, sender, msg, providerName, ct);
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
