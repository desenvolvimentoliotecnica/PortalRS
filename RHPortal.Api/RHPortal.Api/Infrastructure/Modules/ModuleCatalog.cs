namespace RhPortal.Api.Infrastructure.Modules;

/// <summary>
/// Catálogo de módulos (funcionalidades comerciais) disponíveis no sistema.
/// É code-first — mudanças exigem deploy. A tabela <c>TenantModules</c> no master
/// só guarda o estado (ativo/inativo) por tenant.
///
/// Cada módulo define um conjunto de <c>PermissionKeyPrefixes</c> — as permissões
/// do <c>RolePermissionManifest</c> que pertencem a este módulo. Usado para filtrar
/// menus e (fase 2) barrar rotas via <c>ModuleGateMiddleware</c>.
///
/// Módulos marcados como <c>IsCore = true</c> não podem ser desativados.
///
/// Módulos com <c>PackageKey</c> preenchido pertencem a um pacote comercial
/// (<see cref="PackageCatalog"/>): só ficam habilitados para um tenant quando
/// o pacote-pai também estiver habilitado e ativo no catálogo.
/// Módulos com <c>PackageKey = null</c> são:
///   - core (<c>IsCore = true</c>), sempre habilitados, ou
///   - opcionais standalone (sem pacote-pai), contratáveis individualmente.
/// </summary>
public static class ModuleCatalog
{
    public sealed record ModuleDefinition(
        string Key,
        string Name,
        string Description,
        bool IsCore,
        IReadOnlyList<string> PermissionKeyPrefixes,
        string? PackageKey = null);

    public static readonly IReadOnlyList<ModuleDefinition> All = new List<ModuleDefinition>
    {
        // ── Core (sempre ligados) ─────────────────────────────────────────────
        new("dashboard",       "Dashboard",           "Painel inicial e visão geral",                               IsCore: true,  PermissionKeyPrefixes: ["dashboard."]),
        new("administracao",   "Administração",       "Usuários, perfis, menus, acessos, auditoria e logs",          IsCore: true,  PermissionKeyPrefixes: ["users.", "roles.", "menus.", "access.", "audit.", "logs."]),
        new("cadastros",       "Cadastros",           "Áreas, departamentos, unidades, cargos, categorias, funcionários", IsCore: true, PermissionKeyPrefixes: ["departments.", "areas.", "categories.", "jobpositions.", "units.", "funcionarios.", "bloqueio-pessoa."]),
        new("configuracoes",   "Configurações",       "E-mails, Entra ID, idioma e demais configurações",             IsCore: true,  PermissionKeyPrefixes: ["email-", "emails.", "entra-", "localization-"]),

        // ── Pacote: Recrutamento e Seleção ────────────────────────────────────
        new("recrutamento",    "Recrutamento",        "Vagas, solicitações, aprovações, projetos e processo seletivo", IsCore: false, PermissionKeyPrefixes: ["vagas.", "solicitacoes-vaga.", "aprovacoes-vaga.", "projetos.", "processo-seletivo."], PackageKey: "recrutamento-selecao"),
        new("candidatos",      "Candidatos",          "Cadastro, triagem e gestão de candidatos",                     IsCore: false, PermissionKeyPrefixes: ["candidatos.", "triagem."],                                                                PackageKey: "recrutamento-selecao"),
        new("matching",        "Matching por IA",     "Matching de candidatos por embeddings e busca vetorial",       IsCore: false, PermissionKeyPrefixes: ["matching."],                                                                              PackageKey: "recrutamento-selecao"),
        new("portal-vagas",    "Portal de Vagas",     "Portal público de candidatura a vagas",                        IsCore: false, PermissionKeyPrefixes: ["portalvagas.", "entrada."],                                                                PackageKey: "recrutamento-selecao"),
        new("admissao",        "Admissão",            "Pré-admissão, documentos e integração TOTVS",                  IsCore: false, PermissionKeyPrefixes: ["admissao."],                                                                              PackageKey: "recrutamento-selecao"),
        new("agenda",          "Agenda",              "Agendamentos e eventos do pipeline de vaga",                   IsCore: false, PermissionKeyPrefixes: ["agenda."],                                                                                PackageKey: "recrutamento-selecao"),

        // ── Pacote: Gestão de Pessoas ─────────────────────────────────────────
        new("feedback",        "Feedback",            "Feedback, planos de desenvolvimento e one-on-one",             IsCore: false, PermissionKeyPrefixes: ["feedback."],                                                                              PackageKey: "gestao-pessoas"),
        new("gestao",          "Gestão de Pessoas",   "Dashboards de gestão, humor e resumos",                        IsCore: false, PermissionKeyPrefixes: ["gestao."],                                                                                PackageKey: "gestao-pessoas"),
        new("desempenho",      "Desempenho",          "Ciclos de avaliação, Nine Box e comitê de calibragem",         IsCore: false, PermissionKeyPrefixes: ["desempenho."],                                                                            PackageKey: "gestao-pessoas"),

        // ── Pacote: Folha de Pagamento (pacote inativo hoje) ──────────────────
        new("folha-pagamento", "Folha de Pagamento",  "Batida de ponto, pagamentos extras e desligamentos",           IsCore: false, PermissionKeyPrefixes: ["folha."],                                                                                  PackageKey: "folha-pagamento"),

        // ── Standalone opcional (sem pacote-pai) ──────────────────────────────
        new("relatorios",      "Relatórios",          "Relatórios gerenciais",                                        IsCore: false, PermissionKeyPrefixes: ["relatorios."]),
        // Fase 4 LLM-agnóstico (2026-04-26): "ai" é o switch master de IA do tenant.
        // Quando desligado, UnifiedAiService retorna null (early-return) — todas as
        // features que dependem de LLM/embedding via API (CV extract, doc validation,
        // descrição de cargo, sugestão salarial, assistente RH) ficam indisponíveis.
        // Os módulos "matching" (acima) e este são complementares: matching controla
        // só a tela; "ai" controla a infraestrutura inteira.
        new("ai",              "IA (LLM)",            "Provider OpenAI/Gemini/Anthropic — ativa CV extract, descrição de cargo, sugestão salarial, assistente RH, LLM scoring no matching", IsCore: false, PermissionKeyPrefixes: ["ai."]),
    };

    private static readonly Dictionary<string, ModuleDefinition> _byKey =
        All.ToDictionary(m => m.Key, StringComparer.OrdinalIgnoreCase);

    public static ModuleDefinition? GetByKey(string key) =>
        _byKey.TryGetValue(key, out var m) ? m : null;

    public static bool Exists(string key) => _byKey.ContainsKey(key);

    /// <summary>
    /// Resolve o módulo de uma permissionKey (ex. <c>"vagas.view"</c> -> <c>"recrutamento"</c>).
    /// Retorna null se nenhum módulo cobre a permissão (permissão fica sempre liberada).
    /// </summary>
    public static string? ResolveModuleKey(string permissionKey)
    {
        if (string.IsNullOrWhiteSpace(permissionKey)) return null;
        foreach (var m in All)
        {
            foreach (var prefix in m.PermissionKeyPrefixes)
            {
                if (permissionKey.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    return m.Key;
            }
        }
        return null;
    }
}
