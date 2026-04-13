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
        var adminDisplayName = localizer["Seed.AdminUserNameFormat", tenantId.ToUpperInvariant()].Value;
        if (string.IsNullOrWhiteSpace(adminDisplayName) || adminDisplayName == "Seed.AdminUserNameFormat")
            adminDisplayName = $"{tenantId.ToUpperInvariant()} Administrador";
        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                Email = adminEmail,
                UserName = adminEmail,
                FullName = adminDisplayName,
                IsActive = true
            };

            var userResult = await userManager.CreateAsync(adminUser, adminPassword);
            if (!userResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", userResult.Errors.Select(x => x.Description)));
        }
        else if (string.IsNullOrWhiteSpace(adminUser.FullName) || adminUser.FullName == "Seed.AdminUserNameFormat")
        {
            adminUser.FullName = adminDisplayName;
            var updateResult = await userManager.UpdateAsync(adminUser);
            if (!updateResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", updateResult.Errors.Select(x => x.Description)));
        }

        var isInRole = await userManager.IsInRoleAsync(adminUser, "Admin");
        if (!isInRole)
        {
            var addToRole = await userManager.AddToRoleAsync(adminUser, "Admin");
            if (!addToRole.Succeeded)
                throw new InvalidOperationException(string.Join("; ", addToRole.Errors.Select(x => x.Description)));
        }

        await MenuSeeder.EnsureAsync(db, adminRole, localizer, ct);

        // Seed "Administrador" role — tenant-scoped admin with full access, can assume processes
        var administradorRole = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Administrador", ct);
        if (administradorRole is null)
        {
            administradorRole = new ApplicationRole
            {
                Id = Guid.NewGuid(),
                Name = "Administrador",
                Description = "Administrador do tenant — acesso total dentro do tenant.",
                IsActive = true
            };
            var adminstradorResult = await roleManager.CreateAsync(administradorRole);
            if (!adminstradorResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", adminstradorResult.Errors.Select(x => x.Description)));
        }
        await MenuSeeder.EnsureAsync(db, administradorRole, localizer, ct);

        await EmailTemplateSeeder.EnsureAsync(db, localizer, ct);
        await EmailMessageSeeder.EnsureAsync(db, tenantId, emailMessageSeedCount, ct, localizer, randomSeed);
        await EmailConfigSeeder.EnsureAsync(db, tenantId, ct);
    }
}
