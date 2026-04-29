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
            if (!menuByKey.TryGetValue(menu.PermissionKey, out var existing))
                continue;

            var displayChanged = existing.DisplayNameKey != menu.DisplayNameKey || existing.DisplayName != menu.DisplayName;
            var structureChanged = existing.Route != menu.Route
                || existing.Icon != menu.Icon
                || existing.Order != menu.Order
                || existing.OpenInNewTab != menu.OpenInNewTab
                || existing.IsActive != menu.IsActive;

            if (!displayChanged && !structureChanged)
                continue;

            existing.DisplayNameKey = menu.DisplayNameKey;
            existing.DisplayName = menu.DisplayName;
            existing.Route = menu.Route;
            existing.Icon = menu.Icon;
            existing.Order = menu.Order;
            existing.OpenInNewTab = menu.OpenInNewTab;
            existing.IsActive = menu.IsActive;
            updated = true;
        }

        if (updated)
            await db.SaveChangesAsync(ct);

        // Migrate legacy Gestores menu to Funcionarios (Menu row only — RoleMenus no longer used)
        var legacyGestoresMenu = await db.Menus.FirstOrDefaultAsync(x => x.PermissionKey == "managers.view", ct);
        if (legacyGestoresMenu != null)
        {
            var funcionariosMenu = await db.Menus.FirstOrDefaultAsync(x => x.PermissionKey == "funcionarios.view", ct);
            if (funcionariosMenu != null)
            {
                db.Menus.Remove(legacyGestoresMenu);
            }
            else
            {
                legacyGestoresMenu.PermissionKey = "funcionarios.view";
                legacyGestoresMenu.Route = "/Funcionarios";
                legacyGestoresMenu.DisplayNameKey = "Seed.Menu.Funcionarios";
                legacyGestoresMenu.DisplayName = localizer["Seed.Menu.Funcionarios"].Value;
            }
            await db.SaveChangesAsync(ct);
            menuByKey = await db.Menus.ToDictionaryAsync(x => x.PermissionKey, x => x, ct);
        }

        // Migrate BloqueioPessoa menu to Pessoas (route and display name)
        var bloqueioMenu = await db.Menus.FirstOrDefaultAsync(x => x.PermissionKey == "bloqueio-pessoa.view", ct);
        if (bloqueioMenu != null && bloqueioMenu.Route != "/Pessoas")
        {
            bloqueioMenu.Route = "/Pessoas";
            bloqueioMenu.DisplayNameKey = "Seed.Menu.BloqueioPessoa";
            bloqueioMenu.DisplayName = localizer["Seed.Menu.BloqueioPessoa"].Value;
            await db.SaveChangesAsync(ct);
        }

        // Cadastro: uma tela "Função" (PFUNCAO) e uma "Cargo" (PCARGO), nome igual ao RM
        var cadastroUpdated = false;
        var categoriesMenu = await db.Menus.FirstOrDefaultAsync(x => x.PermissionKey == "categories.view", ct);
        if (categoriesMenu != null && (categoriesMenu.Route != "/Cadastro/Funcoes" || categoriesMenu.DisplayNameKey != "Seed.Menu.Funcoes"))
        {
            categoriesMenu.Route = "/Cadastro/Funcoes";
            categoriesMenu.DisplayNameKey = "Seed.Menu.Funcoes";
            categoriesMenu.DisplayName = localizer["Seed.Menu.Funcoes"].Value;
            cadastroUpdated = true;
        }
        var jobpositionsMenu = await db.Menus.FirstOrDefaultAsync(x => x.PermissionKey == "jobpositions.view", ct);
        if (jobpositionsMenu != null && (jobpositionsMenu.Route != "/Cadastro/Cargos" || jobpositionsMenu.DisplayNameKey != "Seed.Menu.Cargos"))
        {
            jobpositionsMenu.Route = "/Cadastro/Cargos";
            jobpositionsMenu.DisplayNameKey = "Seed.Menu.Cargos";
            jobpositionsMenu.DisplayName = localizer["Seed.Menu.Cargos"].Value;
            cadastroUpdated = true;
        }
        if (cadastroUpdated)
            await db.SaveChangesAsync(ct);

        // ── Reparent orphan children ──────────────────────────────────────
        // Items that existed in the DB before their parent group was created
        // still have ParentId = null.  Fix them by matching the descriptors.
        var reparented = false;
        foreach (var d in GetDefaultMenuDescriptors())
        {
            if (d.ParentPermissionKey == null) continue;

            var parentMenu = await db.Menus.FirstOrDefaultAsync(
                x => x.PermissionKey == d.ParentPermissionKey, ct);
            if (parentMenu == null) continue;

            var childMenu = await db.Menus.FirstOrDefaultAsync(
                x => x.PermissionKey == d.PermissionKey, ct);
            if (childMenu == null) continue;
            if (childMenu.ParentId == parentMenu.Id) continue;

            childMenu.ParentId = parentMenu.Id;
            reparented = true;
        }
        if (reparented)
            await db.SaveChangesAsync(ct);

        // RoleMenus seeding removed — permissions are code-first via RolePermissionManifest.
    }

    /// <summary>
    /// Única definição dos menus padrão (usuário padrão e template para Owner).
    /// ParentPermissionKey: quando preenchido, o item é filho do menu com essa PermissionKey.
    /// </summary>
    public static IReadOnlyList<(string Route, string Icon, int Order, string PermissionKey, bool OpenInNewTab, string DisplayNameKey, string? ParentPermissionKey)> GetDefaultMenuDescriptors() =>
    [
        // Início
        ("/Dashboard", "bi-speedometer2", 1, "dashboard.view", false, "Seed.Menu.Dashboard", null),

        // Início do módulo Feedback
        ("/Feedback", "bi-house", 4, "feedback.inicio.view", false, "Seed.Menu.FeedbackInicio", null),

        // Celebrações
        ("/Feedback/Celebracao", "bi-balloon-heart", 5, "feedback.celebracao.view", false, "Seed.Menu.Celebracao", null),

        // Desenvolvimento (grupo) + subitens
        ("#", "bi-journal-plus", 10, "feedback.desenvolvimento", false, "Seed.Menu.Desenvolvimento", null),
        ("/Feedback/Enviar", "bi-send", 11, "feedback.send", false, "Seed.Menu.EnviarFeedback", "feedback.desenvolvimento"),
        ("/Feedback/Feedbacks", "bi-chat-quote", 12, "feedback.view", false, "Seed.Menu.Feedbacks", "feedback.desenvolvimento"),
        ("/Feedback/Reunioes1a1", "bi-people", 14, "feedback.oneonone.view", false, "Seed.Menu.Reunioes1a1", "feedback.desenvolvimento"),

        // Gamificação (grupo + ranking + histórico)
        ("#", "bi-trophy", 20, "feedback.gamificacao.view", false, "Seed.Menu.Gamificacao", null),
        ("/Feedback/Gamificacao", "bi-trophy", 21, "feedback.gamificacao.ranking", false, "Seed.Menu.GamificacaoRanking", "feedback.gamificacao.view"),
        ("/Feedback/GamificacaoHistorico", "bi-clock-history", 22, "feedback.gamificacao.history", false, "Seed.Menu.GamificacaoHistorico", "feedback.gamificacao.view"),

        // Pesquisas (grupo + subitens)
        ("#", "bi-search", 30, "feedback.pesquisas.view", false, "Seed.Menu.Pesquisas", null),
        ("/Feedback/PesquisaRapida", "bi-search-heart", 31, "feedback.pesquisa.rapida", false, "Seed.Menu.PesquisaRapida", "feedback.pesquisas.view"),
        ("/Feedback/SuperPesquisa", "bi-search", 32, "feedback.pesquisa.super", false, "Seed.Menu.SuperPesquisa", "feedback.pesquisas.view"),

        // Gestão (grupo + subitens)
        ("#", "bi-person-badge", 40, "feedback.gestao.view", false, "Seed.Menu.Gestao", null),
        ("/Gestao/Dashboard", "bi-speedometer2", 41, "gestao.dashboard", false, "Seed.Menu.GestaoDashboard", "feedback.gestao.view"),
        ("/Gestao/PlanosDesenvolvimento", "bi-journal-check", 42, "gestao.planos", false, "Seed.Menu.GestaoPlanos", "feedback.gestao.view"),
        ("/Gestao/Humor", "bi-emoji-smile", 43, "gestao.humor", false, "Seed.Menu.GestaoHumor", "feedback.gestao.view"),
        ("/Gestao/ResumoAtividades", "bi-activity", 44, "gestao.resumo", false, "Seed.Menu.GestaoResumo", "feedback.gestao.view"),

        // Desempenho (grupo + item)
        ("#", "bi-bar-chart", 50, "desempenho", false, "Seed.Menu.Desempenho", null),
        ("/Desempenho/MinhasAvaliacoes", "bi-journal-check", 51, "desempenho.minhasavaliacoes", false, "Seed.Menu.MinhasAvaliacoes", "desempenho"),

        // ── Recrutamento: fluxo linear (ordem = passo no processo) ──
        ("/Gestao/Solicitacoes", "clipboardlist", 2, "solicitacoes-vaga.view", true, "Seed.Menu.SolicitacoesVaga", null),
        ("/Vagas", "bi-briefcase", 3, "vagas.view", false, "Seed.Menu.Vagas", null),
        ("/Candidatos", "bi-people", 4, "candidatos.view", false, "Seed.Menu.Candidatos", null),
        ("/Matching", "bi-stars", 5, "matching.view", false, "Seed.Menu.Matching", null),
        ("/Triagem", "bi-funnel", 6, "triagem.view", false, "Seed.Menu.Triagem", null),
        ("/Gestao/Processo-Seletivo", "listchecks", 7, "processo-seletivo.view", false, "Seed.Menu.ProcessoSeletivo", null),
        ("/Admissao", "usercheck", 8, "admissao.view", false, "Seed.Menu.Admissao", null),
        // ── Itens ocultos no sidebar (mantidos para permissões e rotas legadas) ──
        ("/Agendas", "bi-calendar-event", 9, "agenda.view", false, "Seed.Menu.Agenda", null),
        ("/Gestao/Aprovacoes", "listchecks", 50, "aprovacoes-vaga.view", true, "Seed.Menu.Aprovacoes", null),
        ("/PortalVagas", "globe", 51, "portalvagas.view", false, "Seed.Menu.PortalVagas", null),
        ("/Talentos", "bi-person-plus", 52, "talentos.view", false, "Seed.Menu.Talentos", null),
        ("/Gestao/Projetos", "clipboardlist", 53, "projetos.view", false, "Seed.Menu.Rodadas", null),
        ("/EntradaEmailPasta", "bi-inbox", 60, "entrada.view", false, "Seed.Menu.Entrada", null),
        ("/Relatorios", "bi-graph-up", 70, "relatorios.view", false, "Seed.Menu.Relatorios", null),
        ("/Departamentos", "bi-diagram-2", 80, "departments.view", false, "Seed.Menu.Departamentos", null),
        ("/Areas", "bi-diagram-3", 81, "areas.view", false, "Seed.Menu.Areas", null),
        ("/Cadastro/Funcoes", "bi-tags", 82, "categories.view", false, "Seed.Menu.Funcoes", null),
        ("/Cadastro/Cargos", "bi-briefcase", 83, "jobpositions.view", false, "Seed.Menu.Cargos", null),
        ("/Unidades", "bi-building", 84, "units.view", false, "Seed.Menu.Unidades", null),
        ("/Funcionarios", "bi-person-badge", 85, "funcionarios.view", false, "Seed.Menu.Funcionarios", null),
        ("/Pessoas", "bi-person-x", 86, "bloqueio-pessoa.view", false, "Seed.Menu.BloqueioPessoa", null),
        ("/Categorias-Salariais", "bi-cash-coin", 87, "categorias-salariais.view", false, "Seed.Menu.CategoriasSalariais", null),
        ("/Turnos", "bi-clock", 88, "turnos.view", false, "Seed.Menu.Turnos", null),
        ("/Nivel-Cargo", "bi-layers", 84, "nivel-cargo.view", false, "Seed.Menu.NivelCargo", null),
        ("/Centros-Custo", "bi-receipt", 89, "centros-custo.view", false, "Seed.Menu.CentrosCusto", null),
        ("/Unidades-Lotacao", "bi-geo-alt", 90, "unidades-lotacao.view", false, "Seed.Menu.UnidadesLotacao", null),
        ("/Admin/Users", "bi-people", 90, "users.read", false, "Seed.Menu.Usuarios", null),
        ("/Admin/Roles", "bi-shield-lock", 91, "roles.manage", false, "Seed.Menu.Perfis", null),
        ("/Admin/Menus", "bi-list-check", 92, "menus.manage", false, "Seed.Menu.Menus", null),
        ("/Admin/Accesses", "bi-key", 93, "access.manage", false, "Seed.Menu.Acessos", null),
        ("/Admin/Logs", "bi-activity", 94, "audit.view", false, "Seed.Menu.LogsTransacionais", null),
        ("/Admin/OperationalLogs", "bi-journal-text", 95, "logs.view", false, "Seed.Menu.LogsOperacionais", null),
        ("/Admin/EmailTemplates", "bi-envelope-paper", 96, "email-templates.manage", false, "Seed.Menu.TemplatesEmail", null),
        ("/Admin/Emails", "bi-envelope", 97, "emails.manage", false, "Seed.Menu.Emails", null),
        ("/Admin/EmailConfig", "bi-gear", 98, "email-config.manage", false, "Seed.Menu.ConfigEmail", null),
        ("/Admin/EntraIdConfig", "bi-microsoft", 99, "entra-config.manage", false, "Seed.Menu.ConfigEntraId", null),
        ("/Admin/ApiKeys", "bi-key-fill", 100, "api-keys.manage", false, "Seed.Menu.ApiKeys", null),
        ("/Admin/LocalizationConfig", "bi-translate", 101, "localization-config.manage", false, "Seed.Menu.Idioma", null),
        ("/Admin/Gestores", "bi-people", 102, "admin.gestores.manage", false, "Seed.Menu.GestoresHierarquia", null),
        ("/Admin/RegrasAprovacaoVaga", "bi-check2-square", 103, "admin.regras-aprovacao.manage", false, "Seed.Menu.RegrasAprovacao", null),
        ("/Admin/Hierarquia", "bi-diagram-2", 104, "admin.hierarquia.manage", false, "Seed.Menu.NiveisHierarquicos", null),
        ("/Owner/AwsSettings", "cloud-upload", 105, "aws-settings.manage", false, "Seed.Menu.ConfigAws", null)
    ];

    private static List<Menu> BuildDefaultMenus(IStringLocalizer<SeedMessages> localizer)
    {
        string L(string key) => localizer[key].Value;
        var list = new List<Menu>();
        var byPermissionKey = new Dictionary<string, Menu>(StringComparer.OrdinalIgnoreCase);

        foreach (var d in GetDefaultMenuDescriptors())
        {
            if (d.ParentPermissionKey != null)
                continue;
            var menu = new Menu
            {
                Id = Guid.NewGuid(),
                DisplayName = L(d.DisplayNameKey),
                DisplayNameKey = d.DisplayNameKey,
                Route = d.Route,
                Icon = d.Icon,
                Order = d.Order,
                PermissionKey = d.PermissionKey,
                IsActive = true,
                OpenInNewTab = d.OpenInNewTab
            };
            list.Add(menu);
            byPermissionKey[d.PermissionKey] = menu;
        }

        foreach (var d in GetDefaultMenuDescriptors())
        {
            if (d.ParentPermissionKey == null || !byPermissionKey.TryGetValue(d.ParentPermissionKey, out var parent))
                continue;
            var menu = new Menu
            {
                Id = Guid.NewGuid(),
                DisplayName = L(d.DisplayNameKey),
                DisplayNameKey = d.DisplayNameKey,
                Route = d.Route,
                Icon = d.Icon,
                Order = d.Order,
                ParentId = parent.Id,
                PermissionKey = d.PermissionKey,
                IsActive = true,
                OpenInNewTab = d.OpenInNewTab
            };
            list.Add(menu);
            byPermissionKey[d.PermissionKey] = menu;
        }

        return list;
    }
}
