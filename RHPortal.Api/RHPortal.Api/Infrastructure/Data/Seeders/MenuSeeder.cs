using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class MenuSeeder
{
    public static async Task EnsureAsync(AppDbContext db, ApplicationRole adminRole, CancellationToken ct)
    {
        var menus = BuildDefaultMenus();
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

    private static List<Menu> BuildDefaultMenus()
    {
        return new List<Menu>
        {
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Dashboard",
                Route = "/Dashboard",
                Icon = "bi-speedometer2",
                Order = 1,
                PermissionKey = "dashboard.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Agenda",
                Route = "/Agendas",
                Icon = "bi-calendar-event",
                Order = 2,
                PermissionKey = "agenda.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Vagas",
                Route = "/Vagas",
                Icon = "bi-briefcase",
                Order = 3,
                PermissionKey = "vagas.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Candidatos",
                Route = "/Candidatos",
                Icon = "bi-people",
                Order = 4,
                PermissionKey = "candidatos.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Triagem",
                Route = "/Triagem",
                Icon = "bi-funnel",
                Order = 5,
                PermissionKey = "triagem.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Matching",
                Route = "/Matching",
                Icon = "bi-stars",
                Order = 6,
                PermissionKey = "matching.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Portal de Vagas",
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
                DisplayName = "Entrada (Email/Pasta)",
                Route = "/EntradaEmailPasta",
                Icon = "bi-inbox",
                Order = 20,
                PermissionKey = "entrada.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Relatorios",
                Route = "/Relatorios",
                Icon = "bi-graph-up",
                Order = 40,
                PermissionKey = "relatorios.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Departamentos",
                Route = "/Departamentos",
                Icon = "bi-diagram-2",
                Order = 41,
                PermissionKey = "departments.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Centros de Custo",
                Route = "/CentrosCustos",
                Icon = "bi-cash-coin",
                Order = 42,
                PermissionKey = "costcenters.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Areas",
                Route = "/Areas",
                Icon = "bi-diagram-3",
                Order = 43,
                PermissionKey = "areas.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Categorias",
                Route = "/Categorias",
                Icon = "bi-tags",
                Order = 44,
                PermissionKey = "categories.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Cargos",
                Route = "/Cargos",
                Icon = "bi-briefcase",
                Order = 45,
                PermissionKey = "jobpositions.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Unidades",
                Route = "/Unidades",
                Icon = "bi-building",
                Order = 46,
                PermissionKey = "units.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Gestores",
                Route = "/Gestores",
                Icon = "bi-person-badge",
                Order = 47,
                PermissionKey = "managers.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Usuarios",
                Route = "/Admin/Users",
                Icon = "bi-people",
                Order = 80,
                PermissionKey = "users.read",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Perfis",
                Route = "/Admin/Roles",
                Icon = "bi-shield-lock",
                Order = 81,
                PermissionKey = "roles.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Menus",
                Route = "/Admin/Menus",
                Icon = "bi-list-check",
                Order = 82,
                PermissionKey = "menus.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Acessos",
                Route = "/Admin/Accesses",
                Icon = "bi-key",
                Order = 83,
                PermissionKey = "access.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Logs Transacionais",
                Route = "/Admin/Logs",
                Icon = "bi-activity",
                Order = 84,
                PermissionKey = "audit.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Logs Operacionais",
                Route = "/Admin/OperationalLogs",
                Icon = "bi-journal-text",
                Order = 85,
                PermissionKey = "logs.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Templates de Email",
                Route = "/Admin/EmailTemplates",
                Icon = "bi-envelope-paper",
                Order = 86,
                PermissionKey = "email-templates.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Emails",
                Route = "/Admin/Emails",
                Icon = "bi-envelope",
                Order = 87,
                PermissionKey = "emails.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Config Email",
                Route = "/Admin/EmailConfig",
                Icon = "bi-gear",
                Order = 88,
                PermissionKey = "email-config.manage",
                IsActive = true
            }
        };
    }
}
