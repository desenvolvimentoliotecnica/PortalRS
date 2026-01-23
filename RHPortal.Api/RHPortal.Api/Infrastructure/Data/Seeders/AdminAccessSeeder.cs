using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class AdminAccessSeeder
{
    public static async Task EnsureAsync(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        string tenantId,
        string emailDomain,
        string adminPassword,
        int emailMessageSeedCount,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct,
        int? randomSeed = null)
    {
        var adminRole = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Admin", ct);
        if (adminRole is null)
        {
            adminRole = new ApplicationRole
            {
                Id = Guid.NewGuid(),
                Name = "Admin",
                Description = localizer["Seed.AdminRoleDescription"],
                IsActive = true
            };

            var roleResult = await roleManager.CreateAsync(adminRole);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", roleResult.Errors.Select(x => x.Description)));
        }

        var adminEmail = $"admin@{emailDomain}";
        var adminUser = await userManager.Users.FirstOrDefaultAsync(x => x.Email == adminEmail, ct);
        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                Email = adminEmail,
                UserName = adminEmail,
                FullName = localizer["Seed.AdminUserNameFormat", tenantId.ToUpperInvariant()],
                IsActive = true
            };

            var userResult = await userManager.CreateAsync(adminUser, adminPassword);
            if (!userResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", userResult.Errors.Select(x => x.Description)));
        }

        var isInRole = await userManager.IsInRoleAsync(adminUser, "Admin");
        if (!isInRole)
        {
            var addToRole = await userManager.AddToRoleAsync(adminUser, "Admin");
            if (!addToRole.Succeeded)
                throw new InvalidOperationException(string.Join("; ", addToRole.Errors.Select(x => x.Description)));
        }

        await MenuSeeder.EnsureAsync(db, adminRole, localizer, ct);

        await EmailTemplateSeeder.EnsureAsync(db, localizer, ct);
        await EmailMessageSeeder.EnsureAsync(db, tenantId, emailMessageSeedCount, ct, localizer, randomSeed);
        await EmailConfigSeeder.EnsureAsync(db, tenantId, ct);
    }
}
