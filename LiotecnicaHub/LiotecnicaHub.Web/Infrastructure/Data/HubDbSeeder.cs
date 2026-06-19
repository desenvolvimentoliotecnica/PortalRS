using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LiotecnicaHub.Web.Infrastructure.Data;

public static class HubDbSeeder
{
    public static async Task MigrateAndSeedAsync(
        HubDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct = default)
    {
        await db.InitializeSchemaAsync(ct);

        await SeedEntraConfigAsync(db, configuration, logger, ct);
        await SeedLdapConfigAsync(db, logger, ct);
        await SyncEntraPublicUrlsAsync(db, configuration, logger, ct);
        await SeedApplicationsAsync(db, logger, ct);
        await SeedAdminsAsync(db, configuration, logger, ct);
        await HubAccessSeedData.SeedAsync(db, configuration, logger, ct);
    }

    private static async Task SyncEntraPublicUrlsAsync(
        HubDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct)
    {
        var hubBase = configuration["Hub:BaseUrl"] ?? configuration["HUB_BASE_URL"];
        if (string.IsNullOrWhiteSpace(hubBase))
            return;

        hubBase = hubBase.Trim().TrimEnd('/');
        var expectedCallback = $"{hubBase}/Auth/EntraCallback";

        var entity = await db.EntraConfigs.FirstOrDefaultAsync(ct);
        if (entity is null)
            return;

        if (string.Equals(entity.HubBaseUrl, hubBase, StringComparison.OrdinalIgnoreCase)
            && string.Equals(entity.CallbackPath, expectedCallback, StringComparison.OrdinalIgnoreCase))
            return;

        entity.HubBaseUrl = hubBase;
        entity.CallbackPath = expectedCallback;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("HubEntraConfig URLs sincronizadas com HUB_BASE_URL: {BaseUrl}", hubBase);
    }

    private static async Task SeedEntraConfigAsync(
        HubDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct)
    {
        if (await db.EntraConfigs.AnyAsync(ct)) return;

        var now = DateTimeOffset.UtcNow;
        var hubBase = configuration["Hub:BaseUrl"]
            ?? configuration["HUB_BASE_URL"]
            ?? "http://localhost:3010";

        db.EntraConfigs.Add(new HubEntraConfig
        {
            Id = Guid.NewGuid(),
            IsEnabled = false,
            HubBaseUrl = hubBase.TrimEnd('/'),
            CallbackPath = $"{hubBase.TrimEnd('/')}/Auth/EntraCallback",
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });

        await db.SaveChangesAsync(ct);
        logger.LogInformation("HubEntraConfig padrão criado.");
    }

    private static async Task SeedLdapConfigAsync(HubDbContext db, ILogger logger, CancellationToken ct)
    {
        if (await db.LdapConfigs.AnyAsync(ct)) return;

        var now = DateTimeOffset.UtcNow;
        db.LdapConfigs.Add(new HubLdapConfig
        {
            Id = Guid.NewGuid(),
            IsEnabled = false,
            Port = 389,
            UseSsl = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });

        await db.SaveChangesAsync(ct);
        logger.LogInformation("HubLdapConfig padrão criado.");
    }

    private static async Task SeedApplicationsAsync(HubDbContext db, ILogger logger, CancellationToken ct)
    {
        if (await db.Applications.AnyAsync(ct)) return;

        var now = DateTimeOffset.UtcNow;
        var apps = new[]
        {
            new HubApplication
            {
                Id = Guid.NewGuid(),
                Name = "Portal RH — DEV",
                Description = "Ambiente de desenvolvimento do Portal RH LioTecnica.",
                LaunchUrl = "http://10.0.0.79:3000/app/login?tenant=liotecnica",
                Environment = HubApplicationEnvironment.Dev,
                SortOrder = 10,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            },
            new HubApplication
            {
                Id = Guid.NewGuid(),
                Name = "Portal RH — HML",
                Description = "Ambiente de homologação do Portal RH LioTecnica.",
                LaunchUrl = "http://10.0.0.80:3000/app/login?tenant=liotecnica",
                Environment = HubApplicationEnvironment.Hml,
                SortOrder = 20,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            },
            new HubApplication
            {
                Id = Guid.NewGuid(),
                Name = "Portal RH — PRD",
                Description = "Ambiente de produção do Portal RH LioTecnica.",
                LaunchUrl = "http://10.0.0.88:3000/app/login?tenant=liotecnica",
                Environment = HubApplicationEnvironment.Prd,
                SortOrder = 30,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            }
        };

        db.Applications.AddRange(apps);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Aplicações Portal RH (DEV/HML/PRD) criadas no seed.");
    }

    private static async Task SeedAdminsAsync(
        HubDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct)
    {
        var raw = configuration["Hub:SeedAdminEmails"]
            ?? configuration["HUB_SEED_ADMIN_EMAILS"]
            ?? string.Empty;

        var emails = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .Distinct()
            .ToList();

        if (emails.Count == 0)
        {
            logger.LogWarning("Nenhum e-mail admin no seed (Hub:SeedAdminEmails / HUB_SEED_ADMIN_EMAILS).");
            return;
        }

        var existing = await db.Admins.Select(a => a.Email).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var added = 0;

        foreach (var email in emails)
        {
            if (existing.Contains(email)) continue;
            db.Admins.Add(new HubAdmin
            {
                Id = Guid.NewGuid(),
                Email = email,
                CreatedAtUtc = now
            });
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("{Count} admin(s) adicionado(s) via seed.", added);
        }
    }
}
