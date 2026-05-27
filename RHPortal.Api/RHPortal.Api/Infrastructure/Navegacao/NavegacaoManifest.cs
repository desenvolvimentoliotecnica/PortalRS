using RhPortal.Api.Infrastructure.Modules;

namespace RhPortal.Api.Infrastructure.Navegacao;

/// <summary>
/// Manifesto code-first da navegação do app. Cada item declara:
///   - permissão requerida para aparecer (se o usuário não tem, o item não é emitido);
///   - módulo associado — explícito ou resolvido via <see cref="ModuleCatalog.ResolveModuleKey"/>;
///   - bucket de UI (grupoKey) — resolvido via módulo/pacote ou override explícito;
///   - se é "destacado" (aparece no topo, fora de qualquer header, em "Principais").
///
/// Este manifesto substitui o <c>permissionManifest.ts</c> do frontend como única
/// fonte da verdade. O sidebar do Next.js deve consumir o endpoint
/// <c>GET /api/navegacao/sidebar</c> e renderizar o que vier.
/// </summary>
public static class NavegacaoManifest
{
    public sealed record NavManifestItem(
        string Id,
        string Label,
        string Href,
        string Icon,
        string PermissionKey,
        string? ModuloKeyOverride = null,
        string? GrupoUiOverride = null,
        bool Destacado = false,
        int Ordem = 0,
        bool OcultarDoOwner = false,
        // Se true: sidebar usa target=_blank (ex.: Portal de Vagas noutra origem/porta; href pode vir da config).
        bool OpenInNewTab = false);

    public sealed record GrupoUiDefinition(
        string Key,
        string Label,
        int Ordem,
        bool OcultarHeader = false);

    /// <summary>
    /// Buckets de UI exibidos no sidebar. A ordem aqui é a ordem final de render.
    /// <c>principais</c> é especial — header oculto, itens "destacados" vão pra cá.
    /// </summary>
    public static readonly IReadOnlyList<GrupoUiDefinition> Grupos = new List<GrupoUiDefinition>
    {
        new("principais",          "Principais",             Ordem: 0,  OcultarHeader: true),
        new("recrutamento-selecao","Recrutamento e Seleção", Ordem: 10),
        new("gestao-pessoas",      "Gestão de Pessoas",      Ordem: 20),
        new("folha-pagamento",     "Folha de Pagamento",     Ordem: 30),
        new("cadastros",           "Cadastros",              Ordem: 40),
        new("configuracoes",       "Configurações",          Ordem: 50),
        new("administracao",       "Administração",          Ordem: 60),
        new("relatorios",          "Relatórios",             Ordem: 70),
    };

    private static readonly Dictionary<string, GrupoUiDefinition> _gruposByKey =
        Grupos.ToDictionary(g => g.Key, StringComparer.OrdinalIgnoreCase);

    public static GrupoUiDefinition? GetGrupo(string key) =>
        _gruposByKey.TryGetValue(key, out var g) ? g : null;

    /// <summary>
    /// Resolve o <c>grupoUi</c> para um item a partir do módulo dele.
    ///   - destacado → "principais"
    ///   - módulo com PackageKey → grupo = PackageKey (ex.: recrutamento-selecao, gestao-pessoas, folha-pagamento)
    ///   - módulo core → grupo = módulo.Key (administracao/cadastros/configuracoes)
    ///   - módulo standalone (sem pacote, não-core) → grupo = módulo.Key (ex.: relatorios)
    ///   - dashboard sempre vai pra "principais" mesmo sem destacado explícito
    /// </summary>
    public static string ResolveGrupoUi(NavManifestItem item, ModuleCatalog.ModuleDefinition? module)
    {
        if (!string.IsNullOrWhiteSpace(item.GrupoUiOverride))
            return item.GrupoUiOverride!;

        if (item.Destacado)
            return "principais";

        if (module is null)
            return "principais"; // fallback seguro

        if (module.Key.Equals("dashboard", StringComparison.OrdinalIgnoreCase))
            return "principais";

        if (!string.IsNullOrWhiteSpace(module.PackageKey))
            return module.PackageKey!;

        // Core não-dashboard OU standalone → usa a própria key do módulo como bucket
        return module.Key;
    }

    /// <summary>
    /// Manifesto completo de itens. Ordem dentro do bucket segue <see cref="NavManifestItem.Ordem"/>.
    /// Itens sem <c>ModuloKeyOverride</c> são mapeados via <see cref="ModuleCatalog.ResolveModuleKey"/>.
    /// </summary>
    public static readonly IReadOnlyList<NavManifestItem> Items = new List<NavManifestItem>
    {
        // ── Principais (destacados, respeitam gate de módulo) ────────────────
        new("nav-dashboard",                "Dashboard",              "/dashboard",                      "layoutdashboard",   "dashboard.view",           Destacado: true, Ordem: 10),
        // Painel de Solicitações — decidido como TRANSVERSAL CORE (Onda 14, 2026-04-20).
        // Justificativa: agregador analítico multi-tipo (Vaga / Promoção / Desligamento /
        // Férias / Benefício / Dependente / Endereço) que cruza R&S, Folha e Cadastros.
        // Mantê-lo em "Gestão de Pessoas" excluiria o gestor que precisa ver pedidos de
        // R&S e Folha; dividi-lo por pacote (opção B3) perderia a visão consolidada.
        // Fica em "Principais" como "visão consolidada do RH".
        new("nav-painel-solicitacoes",      "Painel de Solicitações", "/gestao/painel-solicitacoes",     "gitbranch",         "gestao.dashboard",         Destacado: true, Ordem: 40),
        new("nav-gestao-solicitacoes-vaga","Solicitações de Vaga",   "/gestao/solicitacoes",            "clipboardlist",     "solicitacoes-vaga.view",   Destacado: true, Ordem: 50),
        new("nav-gestao-aprovacoes-vaga",  "Aprovações",             "/gestao/aprovacoes",               "listchecks",        "aprovacoes-vaga.view",      Destacado: true, Ordem: 60),

        // ── Recrutamento e Seleção (pacote) ──────────────────────────────────
        new("nav-vagas",                    "Vagas",                  "/vagas",                          "briefcase",         "vagas.view",               Ordem: 10),
        new("nav-candidatos",               "Candidatos",             "/candidatos",                     "users",             "candidatos.view",          Ordem: 30),
        new("nav-candidaturas",             "Kanban de Candidaturas", "/recrutamento/candidaturas",      "gitbranch",         "candidatos.view",          Ordem: 35),
        new("nav-propostas-vaga",           "Propostas",              "/recrutamento/propostas-vaga",    "file-text",         "propostas-vaga.view",      Ordem: 38),
        new("nav-admissao",                 "Admissão",               "/admissao",                       "usercheck",         "admissao.view",            Ordem: 40),
        // Fase 4 — Chatbot RAG + geração de conteúdo via Ollama (Qwen 2.5 + bge-m3)
        new("nav-assistente-ia",            "Assistente IA",          "/assistente-ia",                  "bot",               "matching.view",            Ordem: 52, OcultarDoOwner: true),
        new("nav-triagem",                  "Triagem",                "/triagem",                        "filter",            "triagem.view",             Ordem: 60),
        new("nav-pipeline-vagas",           "Pipeline",               "/gestao/pipeline",                "workflow",          "candidatos.view",          Ordem: 65),
        new("nav-processo-seletivo",        "Processo Seletivo",      "/gestao/processo-seletivo",       "listchecks",        "processo-seletivo.view",   Ordem: 70),
        new("nav-agendas",                  "Agenda",                 "/agendas",                        "calendar",          "agenda.view",              Ordem: 80),
        new("nav-portalvagas",              "Portal de Vagas",        "/portalvagas",                    "globe",             "portalvagas.view",         Ordem: 90, OpenInNewTab: true),
        new("nav-painel-rh",                "Painel RH",              "/painel-rh",                      "layoutdashboard",    "entrada.view",             Ordem: 92),
        new("nav-talentos",                 "Banco de Talentos",      "/talentos",                       "sparkles",          "candidatos.view",          ModuloKeyOverride: "candidatos", Ordem: 95),
        new("nav-rh-contrat-triagem",       "Contratações — Triagem",  "/rh/contratacoes/triagem",        "clipboardlist",      "rh.contratacoes.triagem",  Ordem: 96),
        new("nav-rh-contrat-selecao",       "Contratações — Seleção", "/rh/contratacoes/selecao",        "usercheck",          "rh.contratacoes.selecao",  Ordem: 97),
        new("nav-rh-contrat-aprovacoes",    "Contratações — Aprovações", "/gestao/aprovacoes",           "listchecks",         "gestao.dashboard",       Ordem: 98),

        // ── Gestão de Pessoas (pacote) ───────────────────────────────────────
        // (Painel de Solicitações foi promovido para "Principais" — Onda 14)
        new("nav-gestao-dashboard",         "Dashboard Gestão",       "/gestao/dashboard",               "layoutdashboard",   "gestao.dashboard",         Ordem: 20),
        new("nav-planos-desenvolvimento",   "PDI",                    "/gestao/planosdesenvolvimento",   "target",            "feedback.desenvolvimento", Ordem: 30),
        new("nav-humor",                    "Humor",                  "/gestao/humor",                   "smile",             "gestao.humor",             Ordem: 40),
        new("nav-resumo-atividades",        "Resumo de Atividades",   "/gestao/resumoatividades",        "activity",          "gestao.resumo",            Ordem: 50),
        new("nav-feedback-enviar",          "Enviar Feedback",        "/feedback/enviar",                "send",              "feedback.send",            Ordem: 60),
        new("nav-feedback-lista",           "Meus Feedbacks",         "/feedback/feedbacks",             "message-square",    "feedback.view",            Ordem: 70),
        new("nav-feedback-1a1",             "Reuniões 1:1",           "/feedback/reunioes1a1",           "users",             "feedback.oneonone.view",   Ordem: 80),
        new("nav-feedback-celebracao",      "Celebrações",            "/feedback/celebracao",            "party-popper",      "feedback.celebracao.view", Ordem: 90),

        // ── Desempenho (pacote gestao-pessoas — módulo "desempenho", Sessão 30) ──
        // As rotas Next das duas últimas vivem em /feedback/* por razão histórica
        // (o submódulo nasceu embutido no Feedback na Onda 1 do pacote). Migração
        // para /desempenho/* é cosmética e fica pra próxima sessão — o módulo já
        // está declarado no ModuleCatalog (PermissionKeyPrefixes=["desempenho."]),
        // então PermissionKey resolve automaticamente para o módulo correto.
        new("nav-desempenho-minhas",        "Minhas Avaliações",      "/desempenho",                     "trending-up",       "desempenho.view",              Ordem: 100),
        new("nav-desempenho-ciclos",        "Ciclos de Avaliação",    "/feedback/avaliacao",             "target",            "desempenho.ciclos.manage",     Ordem: 110),
        new("nav-desempenho-ninebox",       "Nine Box",               "/feedback/nine-box",              "grid",              "desempenho.calibragem.manage", Ordem: 120),

        // ── Folha de Pagamento (pacote inativo hoje — itens aparecem bloqueados) ──
        new("nav-batida-ponto",             "Batida de Ponto",        "/gestao/batida-ponto",            "clock",             "folha.batida-ponto.view",  ModuloKeyOverride: "folha-pagamento", Ordem: 10),
        new("nav-pagamento-extra",          "Pagamento Extra",        "/gestao/comissoes",               "badge-dollar-sign", "folha.pagamento-extra.view", ModuloKeyOverride: "folha-pagamento", Ordem: 20),
        new("nav-desligamentos",            "Desligamentos",          "/gestao/desligamentos",           "user-minus",        "folha.desligamentos.view", ModuloKeyOverride: "folha-pagamento", Ordem: 30),

        // ── Cadastros (core) ─────────────────────────────────────────────────
        new("nav-empresas",                 "Empresas",               "/empresas",                       "building2",         "areas.view",               Ordem: 10),
        // 31.2: nav-departamentos e nav-areas removidos — Area + Department foram
        // colapsados em CentroCusto. nav-centros-custo herdou a posição (ordem 20).
        new("nav-centros-custo",            "Centros de Custo",       "/centros-custo",                  "landmark",          "areas.view",               Ordem: 20),
        // nav-categorias ("Funções") removido — conceito redundante com Cargos (JobPosition).
        // A entidade RequisitoCategoria foi removida do domínio; a permissão `categories.view`
        // continua ativa apenas porque é compartilhada com "Categorias Salariais" (ordem 100).
        new("nav-cargos",                   "Cargos",                 "/cargos",                         "briefcase",         "jobpositions.view",        Ordem: 50),
        // Funções TOTVS (PFUNCAO) — descrição mais granular do cargo, view derivada com headcount.
        new("nav-funcoes",                  "Funções",                "/funcoes",                        "list-checks",       "jobpositions.view",        Ordem: 55),
        new("nav-nivel-cargo",              "Níveis de Cargo",        "/nivel-cargo",                    "layers",            "jobpositions.view",        Ordem: 58),
        new("nav-descricao-cargo",          "Descrição de Cargos",    "/descricao-cargo",                "file-text",         "jobpositions.view",        Ordem: 60),
        new("nav-unidades",                 "Estabelecimentos",       "/unidades",                       "map-pin",           "units.view",               Ordem: 80),
        new("nav-categorias-salariais",     "Categorias Salariais",   "/categorias-salariais",           "badge-dollar-sign", "categories.view",          Ordem: 100),
        new("nav-turnos",                   "Turnos",                 "/turnos",                         "clock",             "areas.view",               Ordem: 110),
        new("nav-sla-vagas",                "SLA de Vagas",           "/sla-vagas",                      "timer",             "vagas.view",               GrupoUiOverride: "cadastros", Ordem: 115),
        new("nav-pessoas",                  "Pessoas",                "/pessoas",                        "user",              "funcionarios.view",        Ordem: 130),
        new("nav-funcionarios",             "Funcionários",           "/funcionarios",                   "users",             "funcionarios.view",        Ordem: 140),

        // ── Administração (core) ─────────────────────────────────────────────
        new("nav-admin-users",              "Usuários",               "/admin/users",                    "users",             "users.read",               Ordem: 10),
        new("nav-admin-roles",              "Perfis (Roles)",         "/admin/roles",                    "shield",            "roles.manage",             Ordem: 20),
        new("nav-admin-logs",               "Logs operacionais",      "/admin/logs",                     "activity",          "logs.view",                Ordem: 25),
        new("nav-admin-accesses",           "Acessos",                "/admin/accesses",                 "bi-shield-lock",    "access.manage",            Ordem: 30),
        new("nav-admin-organograma",        "Organograma",            "/admin/organograma",              "bi-diagram-2",      "access.manage",            Ordem: 40),
        new("nav-admin-gestores",           "Gestores",               "/admin/gestores",                 "usercheck",         "access.manage",            Ordem: 50),
        new("nav-admin-hierarquia",         "Hierarquia",             "/admin/hierarquia",               "bi-diagram-3",      "access.manage",            Ordem: 60),
        new("nav-admin-doc-padrao",         "Documentação Padrão",    "/admin/documentacao-padrao",      "bi-journal-text",   "documentacao-padrao.manage", Ordem: 100),
        new("nav-admin-integracao-totvs",   "Integração TOTVS",       "/integracao-totvs",               "arrow-right-left",  "access.manage",            Ordem: 104),
        new("nav-admin-requisicoes-rm",     "Requisições RM",         "/admin/requisicoes-rm",           "clipboardlist",    "access.manage",            Ordem: 105),
        new("nav-admin-rm-requisicao-status", "Status RM ⇄ Requisição", "/admin/rm-requisicao-status",   "arrow-right-left", "access.manage",            Ordem: 106),
        new("nav-admin-notif-candidatura",  "Notificações (Candidaturas)", "/administracao/notificacoes-candidatura", "bell-ring", "audit.view",           Ordem: 140),
        new("nav-admin-notif-templates",    "Templates de Notificação",    "/administracao/notificacoes-templates",   "book-template", "audit.view",       Ordem: 145),

        // ── Configurações (core) ─────────────────────────────────────────────
        new("nav-admin-email-config",       "Config. de E-mail",      "/admin/email-config",             "bi-gear",           "email-config.manage",      Ordem: 10),
        new("nav-admin-email-templates",    "Templates de E-mail",    "/admin/email-templates",          "bi-envelope-paper", "email-templates.manage",   Ordem: 20),
        new("nav-admin-emails",             "E-mails Enviados",       "/admin/emails",                   "bi-envelope",       "emails.manage",            Ordem: 30),
        new("nav-admin-entra-id",           "Entra ID",               "/admin/entra-id",                 "bi-microsoft",      "entra-config.manage",      Ordem: 40),
        new("nav-admin-api-keys",           "API Keys",               "/admin/api-keys",                 "bi-key",            "access.manage",            GrupoUiOverride: "configuracoes", Ordem: 50),
        new("nav-admin-localization",       "Localização",            "/admin/localization",             "bi-translate",      "localization-config.manage", Ordem: 60),
        new("nav-admin-tenant-config",      "Configurações do Tenant","/admin/tenant-configuracao",      "bi-gear",           "access.manage",            GrupoUiOverride: "configuracoes", Ordem: 70),
        // Fase 4 LLM-agnóstico — tela única do módulo "ai". Quando módulo OFF,
        // o item ainda aparece para o admin, mas a UI mostra banner "IA não habilitada".
        new("nav-admin-ia",                 "Configuração de IA",     "/admin/ia",                       "brain",             "ai.config",                GrupoUiOverride: "configuracoes", Ordem: 75),
        new("nav-admin-tenant-branding",    "Branding / White-Label", "/admin/tenant-branding",          "palette",           "access.manage",            GrupoUiOverride: "configuracoes", Ordem: 80),

        // ── Relatórios (standalone) ──────────────────────────────────────────
        new("nav-relatorios",               "Relatórios",             "/relatorios",                     "pie-chart",         "relatorios.view",          Ordem: 10),
    };
}
