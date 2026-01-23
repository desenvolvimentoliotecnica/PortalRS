using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class MenuSeeder
{
    public static async Task EnsureAsync(
        AppDbContext db,
        ApplicationRole adminRole,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct)
    {
        var menus = BuildDefaultMenus(localizer);
        foreach (var menu in menus)
        {
            var exists = await db.Menus.AnyAsync(x => x.PermissionKey == menu.PermissionKey, ct);
            if (!exists)
            {
                db.Menus.Add(menu);
            }
        }

        await db.SaveChangesAsync(ct);

        var menuByKey = await db.Menus.ToDictionaryAsync(x => x.PermissionKey, x => x, ct);
        var updated = false;
        foreach (var menu in menus)
        {
            if (string.IsNullOrWhiteSpace(menu.DisplayNameKey))
                continue;

            if (menuByKey.TryGetValue(menu.PermissionKey, out var existing)
                && string.IsNullOrWhiteSpace(existing.DisplayNameKey))
            {
                existing.DisplayNameKey = menu.DisplayNameKey;
                updated = true;
            }
        }

        if (updated)
            await db.SaveChangesAsync(ct);

        var adminMenuAssignments = menuByKey.Values
            .Select(x => (MenuId: x.Id, x.PermissionKey))
            .ToList();

        if (menuByKey.TryGetValue("users.read", out var usersMenu))
            adminMenuAssignments.Add((usersMenu.Id, "users.write"));

        var existingAssignments = await db.RoleMenus
            .Where(x => x.RoleId == adminRole.Id)
            .Select(x => new { x.MenuId, x.PermissionKey })
            .ToListAsync(ct);

        var existingKeys = existingAssignments
            .Select(x => $"{x.MenuId}:{x.PermissionKey}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var toAdd = adminMenuAssignments
            .Where(x => !existingKeys.Contains($"{x.MenuId}:{x.PermissionKey}"))
            .Select(x => new RoleMenu
            {
                Id = Guid.NewGuid(),
                RoleId = adminRole.Id,
                MenuId = x.MenuId,
                PermissionKey = x.PermissionKey
            })
            .ToList();

        if (toAdd.Count > 0)
        {
            db.RoleMenus.AddRange(toAdd);
            await db.SaveChangesAsync(ct);
        }
    }

    private static List<Menu> BuildDefaultMenus(IStringLocalizer<SeedMessages> localizer)
    {
        string L(string key) => localizer[key].Value;

        return new List<Menu>
        {
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Dashboard"),
                DisplayNameKey = "Seed.Menu.Dashboard",
                Route = "/Dashboard",
                Icon = "bi-speedometer2",
                Order = 1,
                PermissionKey = "dashboard.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Agenda"),
                DisplayNameKey = "Seed.Menu.Agenda",
                Route = "/Agendas",
                Icon = "bi-calendar-event",
                Order = 2,
                PermissionKey = "agenda.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Vagas"),
                DisplayNameKey = "Seed.Menu.Vagas",
                Route = "/Vagas",
                Icon = "bi-briefcase",
                Order = 3,
                PermissionKey = "vagas.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Candidatos"),
                DisplayNameKey = "Seed.Menu.Candidatos",
                Route = "/Candidatos",
                Icon = "bi-people",
                Order = 4,
                PermissionKey = "candidatos.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Triagem"),
                DisplayNameKey = "Seed.Menu.Triagem",
                Route = "/Triagem",
                Icon = "bi-funnel",
                Order = 5,
                PermissionKey = "triagem.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Matching"),
                DisplayNameKey = "Seed.Menu.Matching",
                Route = "/Matching",
                Icon = "bi-stars",
                Order = 6,
                PermissionKey = "matching.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.PortalVagas"),
                DisplayNameKey = "Seed.Menu.PortalVagas",
                Route = "/PortalVagas",
                Icon = "bi-globe2",
                Order = 7,
                PermissionKey = "portalvagas.view",
                IsActive = true,
                OpenInNewTab = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Entrada"),
                DisplayNameKey = "Seed.Menu.Entrada",
                Route = "/EntradaEmailPasta",
                Icon = "bi-inbox",
                Order = 20,
                PermissionKey = "entrada.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Relatorios"),
                DisplayNameKey = "Seed.Menu.Relatorios",
                Route = "/Relatorios",
                Icon = "bi-graph-up",
                Order = 40,
                PermissionKey = "relatorios.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Departamentos"),
                DisplayNameKey = "Seed.Menu.Departamentos",
                Route = "/Departamentos",
                Icon = "bi-diagram-2",
                Order = 41,
                PermissionKey = "departments.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.CentrosCustos"),
                DisplayNameKey = "Seed.Menu.CentrosCustos",
                Route = "/CentrosCustos",
                Icon = "bi-cash-coin",
                Order = 42,
                PermissionKey = "costcenters.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Areas"),
                DisplayNameKey = "Seed.Menu.Areas",
                Route = "/Areas",
                Icon = "bi-diagram-3",
                Order = 43,
                PermissionKey = "areas.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Categorias"),
                DisplayNameKey = "Seed.Menu.Categorias",
                Route = "/Categorias",
                Icon = "bi-tags",
                Order = 44,
                PermissionKey = "categories.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Cargos"),
                DisplayNameKey = "Seed.Menu.Cargos",
                Route = "/Cargos",
                Icon = "bi-briefcase",
                Order = 45,
                PermissionKey = "jobpositions.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Unidades"),
                DisplayNameKey = "Seed.Menu.Unidades",
                Route = "/Unidades",
                Icon = "bi-building",
                Order = 46,
                PermissionKey = "units.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Gestores"),
                DisplayNameKey = "Seed.Menu.Gestores",
                Route = "/Gestores",
                Icon = "bi-person-badge",
                Order = 47,
                PermissionKey = "managers.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Usuarios"),
                DisplayNameKey = "Seed.Menu.Usuarios",
                Route = "/Admin/Users",
                Icon = "bi-people",
                Order = 80,
                PermissionKey = "users.read",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Perfis"),
                DisplayNameKey = "Seed.Menu.Perfis",
                Route = "/Admin/Roles",
                Icon = "bi-shield-lock",
                Order = 81,
                PermissionKey = "roles.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Menus"),
                DisplayNameKey = "Seed.Menu.Menus",
                Route = "/Admin/Menus",
                Icon = "bi-list-check",
                Order = 82,
                PermissionKey = "menus.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Acessos"),
                DisplayNameKey = "Seed.Menu.Acessos",
                Route = "/Admin/Accesses",
                Icon = "bi-key",
                Order = 83,
                PermissionKey = "access.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.LogsTransacionais"),
                DisplayNameKey = "Seed.Menu.LogsTransacionais",
                Route = "/Admin/Logs",
                Icon = "bi-activity",
                Order = 84,
                PermissionKey = "audit.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.LogsOperacionais"),
                DisplayNameKey = "Seed.Menu.LogsOperacionais",
                Route = "/Admin/OperationalLogs",
                Icon = "bi-journal-text",
                Order = 85,
                PermissionKey = "logs.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.TemplatesEmail"),
                DisplayNameKey = "Seed.Menu.TemplatesEmail",
                Route = "/Admin/EmailTemplates",
                Icon = "bi-envelope-paper",
                Order = 86,
                PermissionKey = "email-templates.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Emails"),
                DisplayNameKey = "Seed.Menu.Emails",
                Route = "/Admin/Emails",
                Icon = "bi-envelope",
                Order = 87,
                PermissionKey = "emails.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.ConfigEmail"),
                DisplayNameKey = "Seed.Menu.ConfigEmail",
                Route = "/Admin/EmailConfig",
                Icon = "bi-gear",
                Order = 88,
                PermissionKey = "email-config.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.ConfigEntraId"),
                DisplayNameKey = "Seed.Menu.ConfigEntraId",
                Route = "/Admin/EntraIdConfig",
                Icon = "bi-microsoft",
                Order = 89,
                PermissionKey = "entra-config.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = L("Seed.Menu.Idioma"),
                DisplayNameKey = "Seed.Menu.Idioma",
                Route = "/Admin/LocalizationConfig",
                Icon = "bi-translate",
                Order = 90,
                PermissionKey = "localization-config.manage",
                IsActive = true
            }
        };
    }
}
