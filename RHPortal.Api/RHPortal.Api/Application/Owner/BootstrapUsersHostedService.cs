using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Owner;

public sealed class BootstrapUsersHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BootstrapUsersHostedService> _logger;

    public BootstrapUsersHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<BootstrapUsersHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = BootstrapUsersOptions.FromConfiguration(_configuration);
        if (!options.Enabled || options.Tenants.Count == 0)
            return;

        var delay = TimeSpan.FromSeconds(Math.Max(0, options.InitialDelaySeconds));
        if (delay > TimeSpan.Zero)
            await Task.Delay(delay, stoppingToken);

        for (var attempt = 1; attempt <= options.MaxAttempts; attempt++)
        {
            var completed = true;

            foreach (var tenant in options.Tenants)
            {
                if (stoppingToken.IsCancellationRequested)
                    return;

                try
                {
                    var tenantCompleted = await SeedTenantAsync(options, tenant, attempt, stoppingToken);
                    completed = completed && tenantCompleted;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    completed = false;
                    _logger.LogError(ex, "Bootstrap de usuarios falhou para tenant {TenantId}.", tenant.TenantId);
                }
            }

            if (completed)
                return;

            if (attempt < options.MaxAttempts)
            {
                var retryDelay = TimeSpan.FromSeconds(Math.Max(1, options.RetryDelaySeconds));
                _logger.LogInformation(
                    "Bootstrap de usuarios ainda possui pendencias. Nova tentativa em {DelaySeconds}s ({Attempt}/{MaxAttempts}).",
                    retryDelay.TotalSeconds,
                    attempt + 1,
                    options.MaxAttempts);
                await Task.Delay(retryDelay, stoppingToken);
            }
        }
    }

    private async Task<bool> SeedTenantAsync(
        BootstrapUsersOptions options,
        BootstrapUsersTenantOptions tenant,
        int attempt,
        CancellationToken ct)
    {
        var tenantId = tenant.TenantId.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(tenantId) || tenant.Users.Count == 0)
            return true;

        await using var scope = _scopeFactory.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ITenantContext>().SetTenantId(tenantId);

        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var localizer = scope.ServiceProvider.GetRequiredService<IStringLocalizer<SeedMessages>>();

        await MenuRoleSeeder.EnsureRolesExistAsync(roleManager, localizer, ct);
        await MenuRoleSeeder.EnsureDefaultRoleMenuAccessAsync(db, ct);

        var completed = true;
        foreach (var user in tenant.Users)
        {
            if (!user.Enabled || string.IsNullOrWhiteSpace(user.Email))
                continue;

            var normalizedEmail = user.Email.Trim().ToLowerInvariant();
            var funcionarioId = await ResolveFuncionarioIdAsync(db, user, tenantId, attempt, ct);
            if (user.RequireFuncionario && funcionarioId is null)
            {
                completed = false;
                continue;
            }

            var appUser = await userManager.FindByEmailAsync(normalizedEmail);
            if (appUser is null)
            {
                appUser = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    Email = normalizedEmail,
                    UserName = normalizedEmail,
                    FullName = user.FullName,
                    IsActive = true,
                    FuncionarioId = funcionarioId
                };

                var createResult = await userManager.CreateAsync(appUser, options.DefaultPassword);
                ThrowIfFailed(createResult, $"criar usuario {normalizedEmail}");
                _logger.LogInformation("Usuario bootstrap criado para tenant {TenantId}: {Email}.", tenantId, normalizedEmail);
            }
            else
            {
                var changed = false;
                if (!string.Equals(appUser.UserName, normalizedEmail, StringComparison.OrdinalIgnoreCase))
                {
                    appUser.UserName = normalizedEmail;
                    changed = true;
                }

                if (!string.Equals(appUser.Email, normalizedEmail, StringComparison.OrdinalIgnoreCase))
                {
                    appUser.Email = normalizedEmail;
                    changed = true;
                }

                if (!string.Equals(appUser.FullName, user.FullName, StringComparison.Ordinal))
                {
                    appUser.FullName = user.FullName;
                    changed = true;
                }

                if (!appUser.IsActive)
                {
                    appUser.IsActive = true;
                    changed = true;
                }

                if (funcionarioId.HasValue && appUser.FuncionarioId != funcionarioId)
                {
                    appUser.FuncionarioId = funcionarioId;
                    changed = true;
                }

                if (changed)
                {
                    var updateResult = await userManager.UpdateAsync(appUser);
                    ThrowIfFailed(updateResult, $"atualizar usuario {normalizedEmail}");
                }

                if (options.ResetPassword)
                    await EnsurePasswordAsync(userManager, appUser, options.DefaultPassword, normalizedEmail);
            }

            foreach (var roleName in user.Roles.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                var roleExists = await roleManager.RoleExistsAsync(roleName);
                if (!roleExists)
                    throw new InvalidOperationException($"Perfil '{roleName}' nao existe para tenant {tenantId}.");

                var inRole = await userManager.IsInRoleAsync(appUser, roleName);
                if (inRole)
                    continue;

                var addRoleResult = await userManager.AddToRoleAsync(appUser, roleName);
                ThrowIfFailed(addRoleResult, $"associar {normalizedEmail} ao perfil {roleName}");
            }
        }

        return completed;
    }

    private async Task<Guid?> ResolveFuncionarioIdAsync(
        AppDbContext db,
        BootstrapUserOptions user,
        string tenantId,
        int attempt,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(user.FuncionarioMatriculaRm))
            return null;

        var matricula = user.FuncionarioMatriculaRm.Trim();
        var funcionario = await db.Funcionarios
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.MatriculaRm == matricula, ct);

        if (funcionario is not null)
            return funcionario.Id;

        _logger.LogWarning(
            "Bootstrap de usuario aguardando funcionario RM {MatriculaRm} para {Email} no tenant {TenantId} (tentativa {Attempt}).",
            matricula,
            user.Email,
            tenantId,
            attempt);
        return null;
    }

    private static async Task EnsurePasswordAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        string password,
        string email)
    {
        IdentityResult result;
        if (await userManager.HasPasswordAsync(user))
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            result = await userManager.ResetPasswordAsync(user, token, password);
        }
        else
        {
            result = await userManager.AddPasswordAsync(user, password);
        }

        ThrowIfFailed(result, $"definir senha padrao para {email}");
    }

    private static void ThrowIfFailed(IdentityResult result, string action)
    {
        if (result.Succeeded)
            return;

        throw new InvalidOperationException($"Falha ao {action}: {string.Join("; ", result.Errors.Select(x => x.Description))}");
    }

    private sealed class BootstrapUsersOptions
    {
        public bool Enabled { get; init; }
        public string DefaultPassword { get; init; } = string.Empty;
        public bool ResetPassword { get; init; } = true;
        public int InitialDelaySeconds { get; init; } = 180;
        public int RetryDelaySeconds { get; init; } = 60;
        public int MaxAttempts { get; init; } = 30;
        public IReadOnlyList<BootstrapUsersTenantOptions> Tenants { get; init; } = Array.Empty<BootstrapUsersTenantOptions>();

        public static BootstrapUsersOptions FromConfiguration(IConfiguration configuration)
        {
            var section = configuration.GetSection("BootstrapUsers");
            var defaultPassword = section["DefaultPassword"]
                ?? configuration.GetValue<string>("Seed:AdminPassword")
                ?? string.Empty;
            var tenants = section.GetSection("Tenants")
                .GetChildren()
                .Select(BootstrapUsersTenantOptions.FromConfiguration)
                .Where(x => x.Enabled && !string.IsNullOrWhiteSpace(x.TenantId))
                .ToList();

            return new BootstrapUsersOptions
            {
                Enabled = section.GetValue("Enabled", false) && !string.IsNullOrWhiteSpace(defaultPassword),
                DefaultPassword = defaultPassword,
                ResetPassword = section.GetValue("ResetPassword", true),
                InitialDelaySeconds = section.GetValue("InitialDelaySeconds", 180),
                RetryDelaySeconds = section.GetValue("RetryDelaySeconds", 60),
                MaxAttempts = Math.Max(1, section.GetValue("MaxAttempts", 30)),
                Tenants = tenants
            };
        }
    }

    private sealed class BootstrapUsersTenantOptions
    {
        public bool Enabled { get; init; } = true;
        public string TenantId { get; init; } = string.Empty;
        public IReadOnlyList<BootstrapUserOptions> Users { get; init; } = Array.Empty<BootstrapUserOptions>();

        public static BootstrapUsersTenantOptions FromConfiguration(IConfigurationSection section)
        {
            var users = section.GetSection("Users")
                .GetChildren()
                .Select(BootstrapUserOptions.FromConfiguration)
                .Where(x => x.Enabled && !string.IsNullOrWhiteSpace(x.Email))
                .ToList();

            return new BootstrapUsersTenantOptions
            {
                Enabled = section.GetValue("Enabled", true),
                TenantId = section["TenantId"] ?? string.Empty,
                Users = users
            };
        }
    }

    private sealed class BootstrapUserOptions
    {
        public bool Enabled { get; init; } = true;
        public string Email { get; init; } = string.Empty;
        public string FullName { get; init; } = string.Empty;
        public string FuncionarioMatriculaRm { get; init; } = string.Empty;
        public bool RequireFuncionario { get; init; } = true;
        public IReadOnlyList<string> Roles { get; init; } = Array.Empty<string>();

        public static BootstrapUserOptions FromConfiguration(IConfigurationSection section)
        {
            var roles = section.GetSection("Roles")
                .GetChildren()
                .Select(x => x.Value ?? string.Empty)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();

            return new BootstrapUserOptions
            {
                Enabled = section.GetValue("Enabled", true),
                Email = section["Email"] ?? string.Empty,
                FullName = section["FullName"] ?? section["Email"] ?? string.Empty,
                FuncionarioMatriculaRm = section["FuncionarioMatriculaRm"] ?? string.Empty,
                RequireFuncionario = section.GetValue("RequireFuncionario", true),
                Roles = roles
            };
        }
    }
}
