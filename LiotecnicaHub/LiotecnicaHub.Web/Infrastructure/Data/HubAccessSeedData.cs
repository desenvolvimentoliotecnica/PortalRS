using LiotecnicaHub.Web.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LiotecnicaHub.Web.Infrastructure.Data;

/// <summary>
/// Seeds do catálogo IAM — Fase 2.1: perfis concedem acesso a sistemas (launcher).
/// Permissões granulares de ação ficam em cada sistema (Portal RH, etc.).
/// </summary>
public static class HubAccessSeedData
{
    private static readonly Dictionary<string, string[]> ProfileSystemMatrix = new(StringComparer.OrdinalIgnoreCase)
    {
        ["administrador"] = ["hub", "portalrh", "totvs", "intranet", "chamados-ti", "bi", "financeiro", "treinamentos", "documentos"],
        ["colaborador"] = ["portalrh"],
        ["analista-rh"] = ["portalrh"],
        ["coordenador-rh"] = ["portalrh"],
        ["gestor"] = ["portalrh"],
        ["ti"] = ["hub", "chamados-ti"]
    };

    public static async Task SeedAsync(
        HubDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct = default)
    {
        if (!await db.Systems.AnyAsync(ct))
            await SeedFreshCatalogAsync(db, logger, ct);

        await EnsureProfileSystemAccessAsync(db, logger, ct);
        await DeactivateLegacyActionPermissionsAsync(db, logger, ct);
        await LinkPortalRhApplicationsAsync(db, logger, ct);
        await EnsureAdminUsersAsync(db, configuration, logger, ct);
    }

    private static async Task SeedFreshCatalogAsync(HubDbContext db, ILogger logger, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var systems = CreateSystems(now);
        db.Systems.AddRange(systems);

        var hubSystem = systems.First(s => s.Code == "hub");
        var hubModules = CreateHubAdminModules(hubSystem.Id, now);
        db.SystemModules.AddRange(hubModules);

        var hubPermissions = CreateHubAdminPermissions(hubSystem.Id, hubModules, now);
        db.Permissions.AddRange(hubPermissions);

        var profiles = CreateProfiles(now);
        db.Profiles.AddRange(profiles);

        await db.SaveChangesAsync(ct);

        var systemByCode = systems.ToDictionary(s => s.Code, s => s.Id, StringComparer.OrdinalIgnoreCase);
        var profileByCode = profiles.ToDictionary(p => p.Code, p => p.Id, StringComparer.OrdinalIgnoreCase);
        var permissionByCode = hubPermissions.ToDictionary(p => p.Code, p => p.Id, StringComparer.OrdinalIgnoreCase);

        db.ProfileSystemAccesses.AddRange(CreateProfileSystemAccess(profileByCode, systemByCode, now));

        var adminPerms = permissionByCode.Values.ToList();
        db.ProfilePermissions.AddRange(adminPerms.Select(pid => new HubProfilePermission
        {
            ProfileId = profileByCode["administrador"],
            PermissionId = pid,
            CreatedAtUtc = now
        }));

        foreach (var code in new[] { "hub.sistemas.gerenciar", "hub.usuarios.visualizar", "hub.perfis.visualizar", "hub.auditoria.visualizar" })
        {
            if (!permissionByCode.TryGetValue(code, out var pid)) continue;
            db.ProfilePermissions.Add(new HubProfilePermission
            {
                ProfileId = profileByCode["ti"],
                PermissionId = pid,
                CreatedAtUtc = now
            });
        }

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Catálogo IAM seed (2.1): {Systems} sistemas, {Profiles} perfis, acesso por sistema.",
            systems.Count,
            profiles.Count);
    }

    private static async Task EnsureProfileSystemAccessAsync(HubDbContext db, ILogger logger, CancellationToken ct)
    {
        var systems = await db.Systems.AsNoTracking().ToListAsync(ct);
        var profiles = await db.Profiles.ToListAsync(ct);
        if (systems.Count == 0 || profiles.Count == 0) return;

        var systemByCode = systems.ToDictionary(s => s.Code, s => s.Id, StringComparer.OrdinalIgnoreCase);
        var profileByCode = profiles.ToDictionary(p => p.Code, p => p.Id, StringComparer.OrdinalIgnoreCase);
        var existing = await db.ProfileSystemAccesses
            .Select(x => new { x.ProfileId, x.SystemId })
            .ToListAsync(ct);
        var existingSet = existing.Select(x => (x.ProfileId, x.SystemId)).ToHashSet();

        var now = DateTimeOffset.UtcNow;
        var added = 0;

        foreach (var (profileCode, systemCodes) in ProfileSystemMatrix)
        {
            if (!profileByCode.TryGetValue(profileCode, out var profileId)) continue;

            foreach (var systemCode in systemCodes)
            {
                if (!systemByCode.TryGetValue(systemCode, out var systemId)) continue;
                if (existingSet.Contains((profileId, systemId))) continue;

                db.ProfileSystemAccesses.Add(new HubProfileSystemAccess
                {
                    ProfileId = profileId,
                    SystemId = systemId,
                    CreatedAtUtc = now
                });
                added++;
            }
        }

        added += await InferSystemAccessFromLegacyPermissionsAsync(db, profileByCode, systemByCode, existingSet, now, ct);

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("IAM: {Count} vínculo(s) perfil→sistema sincronizado(s).", added);
        }
    }

    private static async Task<int> InferSystemAccessFromLegacyPermissionsAsync(
        HubDbContext db,
        IReadOnlyDictionary<string, Guid> profileByCode,
        IReadOnlyDictionary<string, Guid> systemByCode,
        HashSet<(Guid ProfileId, Guid SystemId)> existingSet,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var legacyLinks = await db.ProfilePermissions.AsNoTracking()
            .Select(pp => new { pp.ProfileId, pp.Permission.Code })
            .ToListAsync(ct);

        var added = 0;
        foreach (var link in legacyLinks)
        {
            var dot = link.Code.IndexOf('.');
            if (dot <= 0) continue;

            var systemCode = link.Code[..dot];
            if (string.Equals(systemCode, "hub", StringComparison.OrdinalIgnoreCase)) continue;
            if (!systemByCode.TryGetValue(systemCode, out var systemId)) continue;
            if (existingSet.Contains((link.ProfileId, systemId))) continue;

            db.ProfileSystemAccesses.Add(new HubProfileSystemAccess
            {
                ProfileId = link.ProfileId,
                SystemId = systemId,
                CreatedAtUtc = now
            });
            existingSet.Add((link.ProfileId, systemId));
            added++;
        }

        return added;
    }

    private static async Task DeactivateLegacyActionPermissionsAsync(HubDbContext db, ILogger logger, CancellationToken ct)
    {
        var legacy = await db.Permissions
            .Where(p => p.IsActive && !p.Code.StartsWith("hub."))
            .ToListAsync(ct);

        if (legacy.Count == 0) return;

        foreach (var perm in legacy)
            perm.IsActive = false;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("IAM: {Count} permissão(ões) de ação legadas desativadas (fora do escopo Hub).", legacy.Count);
    }

    private static async Task LinkPortalRhApplicationsAsync(HubDbContext db, ILogger logger, CancellationToken ct)
    {
        var portalRh = await db.Systems.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Code == "portalrh", ct);
        if (portalRh is null) return;

        var apps = await db.Applications.Where(a => a.SystemId == null).ToListAsync(ct);
        foreach (var app in apps.Where(a => a.Name.Contains("Portal RH", StringComparison.OrdinalIgnoreCase)))
        {
            app.SystemId = portalRh.Id;
            app.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        if (apps.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Aplicativos Portal RH vinculados ao sistema IAM portalrh.");
        }
    }

    private static async Task EnsureAdminUsersAsync(
        HubDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct)
    {
        var adminProfile = await db.Profiles.FirstOrDefaultAsync(p => p.Code == "administrador", ct);
        if (adminProfile is null) return;

        var emails = await CollectAdminEmailsAsync(db, configuration, ct);
        if (emails.Count == 0) return;

        var now = DateTimeOffset.UtcNow;
        var addedUsers = 0;
        var addedLinks = 0;

        foreach (var email in emails)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
            if (user is null)
            {
                user = new HubUser
                {
                    Id = Guid.NewGuid(),
                    Email = email,
                    Name = email.Split('@')[0],
                    IsActive = true,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                };
                db.Users.Add(user);
                addedUsers++;
            }

            var hasProfile = await db.UserProfiles
                .AnyAsync(up => up.UserId == user.Id && up.ProfileId == adminProfile.Id, ct);
            if (!hasProfile)
            {
                db.UserProfiles.Add(new HubUserProfile
                {
                    UserId = user.Id,
                    ProfileId = adminProfile.Id,
                    CreatedAtUtc = now
                });
                addedLinks++;
            }
        }

        if (addedUsers > 0 || addedLinks > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation(
                "IAM admin sync: {Users} usuário(s) criado(s), {Links} vínculo(s) administrador.",
                addedUsers,
                addedLinks);
        }
    }

    private static async Task<List<string>> CollectAdminEmailsAsync(
        HubDbContext db,
        IConfiguration configuration,
        CancellationToken ct)
    {
        var fromConfig = (configuration["Hub:SeedAdminEmails"]
            ?? configuration["HUB_SEED_ADMIN_EMAILS"]
            ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var fromDb = await db.Admins.Select(a => a.Email).ToListAsync(ct);

        return fromConfig.Concat(fromDb)
            .Select(e => e.ToLowerInvariant())
            .Distinct()
            .ToList();
    }

    private static List<HubSystem> CreateSystems(DateTimeOffset now) =>
    [
        Sys("hub", "Hub Corporativo", "Launcher e administração central", null, "grid", now),
        Sys("portalrh", "Portal RH", "Gestão de pessoas e recrutamento", null, "users", now),
        Sys("totvs", "TOTVS", "Sistema de gestão ERP", null, "grid", now),
        Sys("intranet", "Intranet", "Comunicação interna", null, "home", now),
        Sys("chamados-ti", "Chamados TI", "Suporte técnico", null, "headset", now),
        Sys("bi", "BI / Relatórios", "Business Intelligence", null, "chart", now),
        Sys("financeiro", "Financeiro", "Gestão financeira", null, "wallet", now),
        Sys("treinamentos", "Treinamentos", "Capacitação corporativa", null, "book", now),
        Sys("documentos", "Documentos", "Gestão documental", null, "file", now)
    ];

    private static HubSystem Sys(
        string code, string name, string? desc, string? url, string? icon, DateTimeOffset now) =>
        new()
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Description = desc,
            Url = url,
            IconKey = icon,
            IsActive = true,
            RequiresApproval = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

    private static List<HubSystemModule> CreateHubAdminModules(Guid hubSystemId, DateTimeOffset now)
    {
        var order = 0;
        HubSystemModule Mod(string code, string name) => new()
        {
            Id = Guid.NewGuid(),
            SystemId = hubSystemId,
            Code = code,
            Name = name,
            IsActive = true,
            SortOrder = order++,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        return
        [
            Mod("usuarios", "Usuários"),
            Mod("perfis", "Perfis"),
            Mod("sistemas", "Sistemas"),
            Mod("auditoria", "Auditoria")
        ];
    }

    private static List<HubPermission> CreateHubAdminPermissions(
        Guid hubSystemId,
        IReadOnlyList<HubSystemModule> modules,
        DateTimeOffset now)
    {
        var moduleByCode = modules.ToDictionary(m => m.Code, m => m.Id, StringComparer.OrdinalIgnoreCase);

        HubPermission Perm(string moduleCode, string action, string name) => new()
        {
            Id = Guid.NewGuid(),
            SystemId = hubSystemId,
            ModuleId = moduleByCode[moduleCode],
            Code = $"hub.{moduleCode}.{action}",
            Name = name,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        return
        [
            Perm("usuarios", "gerenciar", "Gerenciar usuários do Hub"),
            Perm("usuarios", "visualizar", "Visualizar usuários do Hub"),
            Perm("perfis", "gerenciar", "Gerenciar perfis do Hub"),
            Perm("perfis", "visualizar", "Visualizar perfis do Hub"),
            Perm("sistemas", "gerenciar", "Gerenciar sistemas do Hub"),
            Perm("auditoria", "visualizar", "Visualizar auditoria do Hub")
        ];
    }

    private static List<HubProfile> CreateProfiles(DateTimeOffset now) =>
    [
        Profile("administrador", "Administrador", "Acesso a todos os sistemas via Hub", now),
        Profile("colaborador", "Colaborador", "Acesso ao Portal RH via Hub", now),
        Profile("analista-rh", "Analista RH", "Acesso ao Portal RH via Hub", now),
        Profile("coordenador-rh", "Coordenador RH", "Acesso ao Portal RH via Hub", now),
        Profile("gestor", "Gestor", "Acesso ao Portal RH via Hub", now),
        Profile("ti", "TI", "Administração técnica do Hub", now)
    ];

    private static HubProfile Profile(string code, string name, string? desc, DateTimeOffset now) =>
        new()
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Description = desc,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

    private static IEnumerable<HubProfileSystemAccess> CreateProfileSystemAccess(
        IReadOnlyDictionary<string, Guid> profileByCode,
        IReadOnlyDictionary<string, Guid> systemByCode,
        DateTimeOffset now)
    {
        foreach (var (profileCode, systemCodes) in ProfileSystemMatrix)
        {
            if (!profileByCode.TryGetValue(profileCode, out var profileId)) continue;

            foreach (var systemCode in systemCodes)
            {
                if (!systemByCode.TryGetValue(systemCode, out var systemId)) continue;
                yield return new HubProfileSystemAccess
                {
                    ProfileId = profileId,
                    SystemId = systemId,
                    CreatedAtUtc = now
                };
            }
        }
    }
}
