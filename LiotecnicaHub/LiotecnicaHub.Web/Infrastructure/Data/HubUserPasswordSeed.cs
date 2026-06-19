using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LiotecnicaHub.Web.Infrastructure.Data;

public static class HubUserPasswordSeed
{
    /// <summary>
    /// Garante senha local padrão para admins seed e usuários criados sem hash.
    /// </summary>
    public static async Task SyncAdminPasswordsAsync(
        HubDbContext db,
        IHubPasswordService passwords,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct = default)
    {
        var emails = (configuration["Hub:SeedAdminEmails"]
            ?? configuration["HUB_SEED_ADMIN_EMAILS"]
            ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var fromDb = await db.Admins.AsNoTracking().Select(a => a.Email).ToListAsync(ct);
        foreach (var email in fromDb)
            emails.Add(email);

        if (emails.Count == 0)
            return;

        var users = await db.Users
            .Where(u => emails.Contains(u.Email) && u.PasswordHash == null)
            .ToListAsync(ct);

        if (users.Count == 0)
            return;

        var defaultPassword = passwords.GetDefaultPassword();
        foreach (var user in users)
            user.PasswordHash = passwords.HashPassword(user, defaultPassword);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Senha local padrão aplicada a {Count} admin(s) do Hub.", users.Count);
    }
}
