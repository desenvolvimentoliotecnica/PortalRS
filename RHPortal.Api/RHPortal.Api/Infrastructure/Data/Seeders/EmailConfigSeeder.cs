using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class EmailConfigSeeder
{
    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        var exists = await db.EmailConfigs.AnyAsync(x => x.TenantId == tenantId, ct);
        if (exists) return;

        var now = DateTimeOffset.UtcNow;
        db.EmailConfigs.Add(new EmailConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Provider = "smtp",
            SmtpHost = "smtp.gmail.com",
            SmtpPort = 587,
            SmtpEnableSsl = true,
            SmtpUserName = "leonardomendes201704@gmail.com",
            SmtpFromName = "Portal RH",
            SmtpFromAddress = "leonardomendes201704@gmail.com",
            ImapHost = "imap.gmail.com",
            ImapPort = 993,
            ImapEnableSsl = true,
            ImapUserName = "leonardomendes201704@gmail.com",
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });

        await db.SaveChangesAsync(ct);
    }
}
