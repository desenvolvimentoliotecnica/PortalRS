using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Owner;

public sealed class TenantProvisioningService : ITenantProvisioningService
{
    private readonly MasterDbContext _masterDb;
    private readonly IConfiguration _configuration;
    private readonly ITenantContext _tenantContext;
    private readonly IServiceProvider _scope;

    public TenantProvisioningService(
        MasterDbContext masterDb,
        IConfiguration configuration,
        ITenantContext tenantContext,
        IServiceProvider scope)
    {
        _masterDb = masterDb;
        _configuration = configuration;
        _tenantContext = tenantContext;
        _scope = scope;
    }

    public async Task ProvisionTenantAsync(string tenantId, string name, bool seedAfterCreate = false, Guid? createdByOwnerId = null, CancellationToken ct = default)
    {
        await TenantSeeder.EnsureAsync(_masterDb, tenantId, name, createdByOwnerId, ct);
        await TenantDatabaseEnsurer.EnsureTenantDatabaseExistsAsync(_configuration, tenantId, ct);
        _tenantContext.SetTenantId(tenantId);
        var db = _scope.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync(ct);
        if (seedAfterCreate)
            await RunSeedAsync(tenantId, db, ct);
    }

    public async Task SeedTenantAsync(string tenantId, CancellationToken ct = default)
    {
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var localizer = scope.ServiceProvider.GetRequiredService<IStringLocalizer<SeedMessages>>();
        var adminPassword = _configuration.GetValue<string>("Seed:AdminPassword") ?? "ChangeThisPassword123!";
        var emailDomain = "dev.local";
        await AdminAccessSeeder.EnsureAsync(db, userManager, roleManager, tenantId, emailDomain, adminPassword, 0, localizer, ct, null);
        await AreaDepartmentSeeder.EnsureAsync(db, emailDomain, ct);
        await AgendaTypeSeeder.EnsureDefaultAsync(db, localizer, ct);
        await UnitSeeder.EnsureAsync(db, ct);
        await JobPositionSeeder.EnsureAsync(db, localizer, ct);
    }

    private async Task RunSeedAsync(string tenantId, AppDbContext db, CancellationToken ct)
    {
        var userManager = _scope.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = _scope.GetRequiredService<RoleManager<ApplicationRole>>();
        var localizer = _scope.GetRequiredService<IStringLocalizer<SeedMessages>>();
        var adminPassword = _configuration.GetValue<string>("Seed:AdminPassword") ?? "ChangeThisPassword123!";
        var emailDomain = "dev.local";
        await AdminAccessSeeder.EnsureAsync(db, userManager, roleManager, tenantId, emailDomain, adminPassword, 0, localizer, ct, null);
        await AreaDepartmentSeeder.EnsureAsync(db, emailDomain, ct);
        await AgendaTypeSeeder.EnsureDefaultAsync(db, localizer, ct);
        await UnitSeeder.EnsureAsync(db, ct);
        await JobPositionSeeder.EnsureAsync(db, localizer, ct);
    }
}
