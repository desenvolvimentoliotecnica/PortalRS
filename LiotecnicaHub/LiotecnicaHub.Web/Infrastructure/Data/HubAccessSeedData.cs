using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LiotecnicaHub.Web.Infrastructure.Data;

/// <summary>
/// Seeds idempotentes do catálogo IAM (Fase 1).
/// </summary>
public static class HubAccessSeedData
{
    public static async Task SeedAsync(
        HubDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct = default)
    {
        if (await db.Systems.AnyAsync(ct))
        {
            await LinkPortalRhApplicationsAsync(db, logger, ct);
            await EnsureAdminUsersAsync(db, configuration, logger, ct);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var systems = CreateSystems(now);
        db.Systems.AddRange(systems);

        var modules = CreateModules(systems, now);
        db.SystemModules.AddRange(modules);

        var permissions = CreatePermissions(systems, modules, now);
        db.Permissions.AddRange(permissions);

        var profiles = CreateProfiles(now);
        db.Profiles.AddRange(profiles);

        await db.SaveChangesAsync(ct);

        var permissionByCode = await db.Permissions.AsNoTracking()
            .ToDictionaryAsync(p => p.Code, p => p.Id, StringComparer.OrdinalIgnoreCase, ct);

        var profilePermissions = CreateProfilePermissions(profiles, permissionByCode, now);
        db.ProfilePermissions.AddRange(profilePermissions);

        var demoScope = new HubAccessScope
        {
            Id = Guid.NewGuid(),
            Name = "Filial Guarulhos",
            ScopeType = HubAccessScopeType.Filial,
            ExternalCode = "guarulhos",
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        db.AccessScopes.Add(demoScope);

        await db.SaveChangesAsync(ct);
        await LinkPortalRhApplicationsAsync(db, logger, ct);
        await EnsureAdminUsersAsync(db, configuration, logger, ct);

        logger.LogInformation(
            "Catálogo IAM seed: {Systems} sistemas, {Modules} módulos, {Permissions} permissões, {Profiles} perfis.",
            systems.Count,
            modules.Count,
            permissions.Count,
            profiles.Count);
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

    private static List<HubSystemModule> CreateModules(IReadOnlyList<HubSystem> systems, DateTimeOffset now)
    {
        var byCode = systems.ToDictionary(s => s.Code, s => s.Id, StringComparer.OrdinalIgnoreCase);
        var list = new List<HubSystemModule>();
        var order = 0;

        void Add(string systemCode, string code, string name)
        {
            list.Add(new HubSystemModule
            {
                Id = Guid.NewGuid(),
                SystemId = byCode[systemCode],
                Code = code,
                Name = name,
                IsActive = true,
                SortOrder = order++,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }

        order = 0;
        Add("hub", "aplicativos", "Aplicativos");
        Add("hub", "favoritos", "Favoritos");
        Add("hub", "notificacoes", "Notificações");
        Add("hub", "suporte", "Suporte");
        Add("hub", "configuracoes", "Configurações");
        Add("hub", "usuarios", "Usuários");
        Add("hub", "perfis", "Perfis");
        Add("hub", "sistemas", "Sistemas");
        Add("hub", "permissoes", "Permissões");
        Add("hub", "auditoria", "Auditoria");

        order = 0;
        Add("portalrh", "vagas", "Vagas");
        Add("portalrh", "candidatos", "Candidatos");
        Add("portalrh", "requisicoes", "Requisições TOTVS");
        Add("portalrh", "entrevistas", "Entrevistas");
        Add("portalrh", "configuracoes", "Configurações");
        Add("portalrh", "usuarios", "Usuários");
        Add("portalrh", "perfis", "Perfis");
        Add("portalrh", "permissoes", "Permissões");
        Add("portalrh", "meu-perfil", "Meu perfil");
        Add("portalrh", "minhas-candidaturas", "Minhas candidaturas");

        return list;
    }

    private static List<HubPermission> CreatePermissions(
        IReadOnlyList<HubSystem> systems,
        IReadOnlyList<HubSystemModule> modules,
        DateTimeOffset now)
    {
        var systemByCode = systems.ToDictionary(s => s.Code, s => s.Id, StringComparer.OrdinalIgnoreCase);
        var moduleKey = modules.ToDictionary(
            m => $"{systems.First(s => s.Id == m.SystemId).Code}.{m.Code}",
            m => m.Id,
            StringComparer.OrdinalIgnoreCase);

        var list = new List<HubPermission>();

        void Perm(string systemCode, string moduleCode, string action, string name)
        {
            var code = $"{systemCode}.{moduleCode}.{action}";
            list.Add(new HubPermission
            {
                Id = Guid.NewGuid(),
                SystemId = systemByCode[systemCode],
                ModuleId = moduleKey[$"{systemCode}.{moduleCode}"],
                Code = code,
                Name = name,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }

        // Hub
        Perm("hub", "aplicativos", "visualizar", "Visualizar aplicativos");
        Perm("hub", "favoritos", "gerenciar", "Gerenciar favoritos");
        Perm("hub", "notificacoes", "visualizar", "Visualizar notificações");
        Perm("hub", "suporte", "criar-chamado", "Criar chamado de suporte");
        Perm("hub", "suporte", "gerenciar", "Gerenciar suporte");
        Perm("hub", "usuarios", "gerenciar", "Gerenciar usuários");
        Perm("hub", "usuarios", "visualizar", "Visualizar usuários");
        Perm("hub", "perfis", "gerenciar", "Gerenciar perfis");
        Perm("hub", "perfis", "visualizar", "Visualizar perfis");
        Perm("hub", "sistemas", "gerenciar", "Gerenciar sistemas");
        Perm("hub", "permissoes", "gerenciar", "Gerenciar permissões");
        Perm("hub", "auditoria", "visualizar", "Visualizar auditoria");

        // Portal RH — Vagas
        Perm("portalrh", "vagas", "visualizar", "Visualizar vagas");
        Perm("portalrh", "vagas", "criar", "Criar vaga");
        Perm("portalrh", "vagas", "editar", "Editar vaga");
        Perm("portalrh", "vagas", "publicar", "Publicar vaga");
        Perm("portalrh", "vagas", "suspender", "Suspender vaga");
        Perm("portalrh", "vagas", "encerrar", "Encerrar vaga");
        Perm("portalrh", "vagas", "excluir", "Excluir vaga");

        // Candidatos
        Perm("portalrh", "candidatos", "visualizar", "Visualizar candidatos");
        Perm("portalrh", "candidatos", "visualizar-dados-sensiveis", "Visualizar dados sensíveis");
        Perm("portalrh", "candidatos", "editar", "Editar candidato");
        Perm("portalrh", "candidatos", "triar", "Fazer triagem");
        Perm("portalrh", "candidatos", "aprovar", "Aprovar candidato");
        Perm("portalrh", "candidatos", "reprovar", "Reprovar candidato");
        Perm("portalrh", "candidatos", "exportar", "Exportar candidatos");

        // Requisições
        Perm("portalrh", "requisicoes", "visualizar", "Visualizar requisições");
        Perm("portalrh", "requisicoes", "importar", "Importar requisições");
        Perm("portalrh", "requisicoes", "aprovar", "Aprovar requisição");
        Perm("portalrh", "requisicoes", "reprovar", "Reprovar requisição");
        Perm("portalrh", "requisicoes", "vincular-vaga", "Vincular requisição a vaga");

        // Entrevistas
        Perm("portalrh", "entrevistas", "visualizar", "Visualizar entrevistas");
        Perm("portalrh", "entrevistas", "agendar", "Agendar entrevista");
        Perm("portalrh", "entrevistas", "cancelar", "Cancelar entrevista");
        Perm("portalrh", "entrevistas", "avaliar", "Avaliar entrevista");

        // Configurações Portal RH
        Perm("portalrh", "configuracoes", "visualizar", "Visualizar configurações");
        Perm("portalrh", "configuracoes", "editar", "Editar configurações");
        Perm("portalrh", "usuarios", "gerenciar", "Gerenciar usuários");
        Perm("portalrh", "perfis", "gerenciar", "Gerenciar perfis");
        Perm("portalrh", "permissoes", "gerenciar", "Gerenciar permissões");

        // Colaborador
        Perm("portalrh", "meu-perfil", "visualizar", "Visualizar meu perfil");
        Perm("portalrh", "minhas-candidaturas", "visualizar", "Visualizar minhas candidaturas");

        return list;
    }

    private static List<HubProfile> CreateProfiles(DateTimeOffset now) =>
    [
        Profile("administrador", "Administrador", "Acesso total ao Hub e Portal RH", now),
        Profile("colaborador", "Colaborador", "Acesso básico ao Hub e área do colaborador", now),
        Profile("analista-rh", "Analista RH", "Operação de vagas e candidatos", now),
        Profile("coordenador-rh", "Coordenador RH", "Coordenação de recrutamento", now),
        Profile("gestor", "Gestor", "Aprovações e visão gerencial", now),
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

    private static List<HubProfilePermission> CreateProfilePermissions(
        IReadOnlyList<HubProfile> profiles,
        IReadOnlyDictionary<string, Guid> permissionByCode,
        DateTimeOffset now)
    {
        var profileByCode = profiles.ToDictionary(p => p.Code, p => p.Id, StringComparer.OrdinalIgnoreCase);
        var list = new List<HubProfilePermission>();

        void Assign(string profileCode, params string[] codes)
        {
            foreach (var code in codes)
            {
                if (!permissionByCode.TryGetValue(code, out var permId)) continue;
                list.Add(new HubProfilePermission
                {
                    ProfileId = profileByCode[profileCode],
                    PermissionId = permId,
                    CreatedAtUtc = now
                });
            }
        }

        var allPortalRh = permissionByCode.Keys
            .Where(c => c.StartsWith("portalrh.", StringComparison.OrdinalIgnoreCase))
            .ToArray();

        var allHub = permissionByCode.Keys
            .Where(c => c.StartsWith("hub.", StringComparison.OrdinalIgnoreCase))
            .ToArray();

        Assign("administrador", allHub);
        Assign("administrador", allPortalRh);

        Assign("colaborador",
            "hub.aplicativos.visualizar",
            "hub.favoritos.gerenciar",
            "hub.notificacoes.visualizar",
            "hub.suporte.criar-chamado",
            "portalrh.meu-perfil.visualizar",
            "portalrh.minhas-candidaturas.visualizar");

        Assign("analista-rh",
            "hub.aplicativos.visualizar",
            "portalrh.vagas.visualizar",
            "portalrh.vagas.criar",
            "portalrh.vagas.editar",
            "portalrh.candidatos.visualizar",
            "portalrh.candidatos.triar",
            "portalrh.entrevistas.visualizar",
            "portalrh.entrevistas.agendar",
            "portalrh.requisicoes.visualizar",
            "portalrh.requisicoes.vincular-vaga");

        Assign("coordenador-rh",
            "hub.aplicativos.visualizar",
            "portalrh.vagas.visualizar",
            "portalrh.vagas.criar",
            "portalrh.vagas.editar",
            "portalrh.vagas.publicar",
            "portalrh.vagas.suspender",
            "portalrh.vagas.encerrar",
            "portalrh.candidatos.visualizar",
            "portalrh.candidatos.triar",
            "portalrh.candidatos.aprovar",
            "portalrh.candidatos.reprovar",
            "portalrh.entrevistas.visualizar",
            "portalrh.entrevistas.agendar",
            "portalrh.requisicoes.visualizar",
            "portalrh.requisicoes.aprovar",
            "portalrh.requisicoes.reprovar",
            "portalrh.requisicoes.vincular-vaga");

        Assign("gestor",
            "hub.aplicativos.visualizar",
            "portalrh.requisicoes.visualizar",
            "portalrh.requisicoes.aprovar",
            "portalrh.requisicoes.reprovar",
            "portalrh.vagas.visualizar",
            "portalrh.candidatos.visualizar",
            "portalrh.entrevistas.visualizar");

        Assign("ti",
            "hub.sistemas.gerenciar",
            "hub.usuarios.visualizar",
            "hub.perfis.visualizar",
            "hub.auditoria.visualizar",
            "hub.suporte.gerenciar");

        return list;
    }
}
