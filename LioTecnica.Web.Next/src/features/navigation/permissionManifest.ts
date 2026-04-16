import type { BffNavItem } from "@/lib/schemas/bff";

/**
 * Code-first nav manifest.
 * Each entry defines one sidebar item and the permission key required to show it.
 * Owner ("*") and full-access roles (Admin, RH) see everything.
 * Gestor/Compliance only see items whose permission is in their restricted set.
 *
 * To add a new screen: add one entry here — no DB seeding, no per-tenant config.
 */
const NAV_MANIFEST: ReadonlyArray<{
    id: string;
    label: string;
    href: string;
    icon: string;
    permission: string;
}> = [
    // ── Top-level (outside any group) ──────────────────────────────────
    { id: "nav-dashboard",                 label: "Dashboard",                  href: "/dashboard",                      icon: "layoutdashboard",  permission: "dashboard.view" },
    { id: "nav-aprovacoes",                label: "Minhas Pendências",           href: "/gestao/aprovacoes",              icon: "checkcheck",       permission: "aprovacoes-vaga.view" },
    { id: "nav-solicitacoes",              label: "Solicitações",                href: "/gestao/solicitacoes",            icon: "clipboardlist",    permission: "solicitacoes-vaga.view" },
    { id: "nav-painel-solicitacoes",       label: "Painel de Solicitações",      href: "/gestao/painel-solicitacoes",     icon: "gitbranch",        permission: "gestao.dashboard" },
    { id: "nav-agendas",                   label: "Agenda",                     href: "/agendas",                        icon: "calendar",         permission: "agenda.view" },

    // ── Colaborador ────────────────────────────────────────────────────

    // ── Recrutamento & Seleção ─────────────────────────────────────────
    { id: "nav-vagas",                     label: "Vagas",                       href: "/vagas",                          icon: "briefcase",        permission: "vagas.view" },
    { id: "nav-candidatos",                label: "Candidatos",                  href: "/candidatos",                     icon: "users",            permission: "candidatos.view" },
    { id: "nav-painel-rh",                 label: "Painel RH",                   href: "/painel-rh",                      icon: "clipboardcheck",   permission: "entrada.view" },
    { id: "nav-matching",                  label: "Matching IA",                 href: "/matching",                       icon: "bi-stars",         permission: "matching.view" },
    { id: "nav-triagem",                   label: "Pipeline",                    href: "/triagem",                        icon: "bi-funnel",        permission: "triagem.view" },
    { id: "nav-processo-seletivo",         label: "Processo Seletivo",           href: "/gestao/processo-seletivo",       icon: "listchecks",       permission: "processo-seletivo.view" },
    { id: "nav-admissao",                  label: "Admissão",                    href: "/admissao",                       icon: "usercheck",        permission: "admissao.view" },
    { id: "nav-portalvagas",               label: "Portal de Vagas",             href: "/portalvagas",                    icon: "globe",            permission: "portalvagas.view" },

    // ── Gestão de Pessoas & Feedback ───────────────────────────────────
    { id: "nav-gestao-dashboard",          label: "Dashboard Gestão",            href: "/gestao/dashboard",               icon: "layoutdashboard",  permission: "gestao.dashboard" },
    { id: "nav-batidaponto",               label: "Batida de Ponto",             href: "/gestao/batida-ponto",            icon: "bi-clock-history", permission: "agenda.view" }, // Reusing general view
    { id: "nav-comissoes",                 label: "Pagamento extra",             href: "/gestao/comissoes",               icon: "bi-bar-chart",     permission: "relatorios.view" }, // Reusing general view
    { id: "nav-desligamentos",             label: "Desligamentos",               href: "/gestao/desligamentos",           icon: "user-minus",       permission: "gestao.resumo" },
    { id: "nav-planos-desenvolvimento",    label: "PDI",                         href: "/gestao/planosdesenvolvimento",   icon: "target",           permission: "feedback.desenvolvimento" },
    { id: "nav-humor",                     label: "Humor",                       href: "/gestao/humor",                   icon: "smile",            permission: "gestao.humor" },
    { id: "nav-resumo-atividades",         label: "Resumo Atividades",           href: "/gestao/resumoatividades",        icon: "activity",         permission: "gestao.resumo" },
    { id: "nav-feedback-enviar",           label: "Enviar Feedback",             href: "/feedback/enviar",                icon: "send",             permission: "feedback.send" },
    { id: "nav-feedback-lista",            label: "Meus Feedbacks",              href: "/feedback/feedbacks",             icon: "message-square",   permission: "feedback.view" },
    { id: "nav-feedback-1a1",              label: "Reuniões 1a1",                href: "/feedback/reunioes1a1",           icon: "users",            permission: "feedback.oneonone.view" },
    { id: "nav-feedback-gamificacao",      label: "Gamificação",                 href: "/feedback/gamificacao",           icon: "award",            permission: "feedback.gamificacao.view" },
    { id: "nav-feedback-celebracao",       label: "Celebrações",                 href: "/feedback/celebracao",            icon: "party-popper",     permission: "feedback.celebracao.view" },

    // ── Cadastros Operacionais ─────────────────────────────────────────
    { id: "nav-empresas",                  label: "Empresas",                    href: "/empresas",                       icon: "building2",        permission: "areas.view" },
    { id: "nav-departamentos",             label: "Departamentos",               href: "/departamentos",                  icon: "layers",           permission: "departments.view" },
    { id: "nav-areas",                     label: "Áreas",                       href: "/areas",                          icon: "grid",             permission: "areas.view" },
    { id: "nav-categorias",                label: "Funções",                     href: "/categorias",                     icon: "tags",             permission: "categories.view" },
    { id: "nav-cargos",                    label: "Cargos",                      href: "/cargos",                         icon: "briefcase",        permission: "jobpositions.view" },
    { id: "nav-unidades",                  label: "Unidades",                    href: "/unidades",                       icon: "map-pin",          permission: "units.view" },
    { id: "nav-centros-custo",             label: "Centros de Custo",            href: "/centros-custo",                  icon: "landmark",         permission: "areas.view" },
    { id: "nav-categorias-salariais",      label: "Categorias Salariais",        href: "/categorias-salariais",           icon: "badge-dollar-sign", permission: "categories.view" },
    { id: "nav-turnos",                    label: "Turnos",                      href: "/turnos",                         icon: "clock",            permission: "areas.view" },
    { id: "nav-unidades-lotacao",          label: "Unidades de Lotação",         href: "/unidades-lotacao",               icon: "building",         permission: "units.view" },
    { id: "nav-pessoas",                   label: "Pessoas",                     href: "/pessoas",                        icon: "user",             permission: "funcionarios.view" },
    { id: "nav-funcionarios",              label: "Funcionários",                href: "/funcionarios",                   icon: "users",            permission: "funcionarios.view" },
    { id: "nav-bloqueiopessoa",            label: "Bloqueio de Pessoa",          href: "/bloqueiopessoa",                 icon: "user-x",           permission: "funcionarios.view" },
    { id: "nav-talentos",                  label: "Talentos",                    href: "/talentos",                       icon: "sparkles",         permission: "candidatos.view" },
    { id: "nav-relatorios",                label: "Relatórios",                  href: "/relatorios",                     icon: "pie-chart",        permission: "relatorios.view" },

    // ── Admin ──────────────────────────────────────────────────────────
    { id: "nav-admin-users",               label: "Usuários",                    href: "/admin/users",                    icon: "users",             permission: "users.read" },
    { id: "nav-admin-roles",               label: "Perfis (Roles)",              href: "/admin/roles",                    icon: "shield",            permission: "roles.manage" },
    { id: "nav-configuracao-aprovacoes",   label: "Configuração de Aprovações",  href: "/admin/configuracao-aprovacoes",  icon: "settings2",         permission: "access.manage" },
    { id: "nav-aprovadores-alternativos",  label: "Aprovadores Alternativos",    href: "/admin/aprovadores-alternativos", icon: "user-check",        permission: "access.manage" },
    { id: "nav-admin-accesses",            label: "Acessos",                     href: "/admin/accesses",                 icon: "bi-shield-lock",    permission: "access.manage" },
    { id: "nav-admin-gestores",            label: "Gestores",                    href: "/admin/gestores",                 icon: "usercheck",         permission: "access.manage" },
    { id: "nav-admin-hierarquia",          label: "Hierarquia",                  href: "/admin/hierarquia",               icon: "bi-diagram-3",      permission: "access.manage" },
    { id: "nav-admin-organograma",         label: "Organograma",                 href: "/admin/organograma",              icon: "bi-diagram-2",      permission: "access.manage" },
    { id: "nav-admin-headcount",           label: "Headcount",                   href: "/admin/configuracoes-headcount",  icon: "users",             permission: "access.manage" },
    { id: "nav-admin-doc-padrao",          label: "Documentação Padrão",         href: "/admin/documentacao-padrao",      icon: "bi-journal-text",   permission: "access.manage" },
    { id: "nav-admin-email-config",        label: "Config. de E-mail",           href: "/admin/email-config",             icon: "bi-gear",           permission: "access.manage" },
    { id: "nav-admin-email-templates",     label: "Templates de E-mail",         href: "/admin/email-templates",          icon: "bi-envelope-paper", permission: "access.manage" },
    { id: "nav-admin-emails",              label: "E-mails Enviados",            href: "/admin/emails",                   icon: "bi-envelope",       permission: "access.manage" },
    { id: "nav-admin-entra-id",            label: "Entra ID",                    href: "/admin/entra-id",                 icon: "bi-microsoft",      permission: "access.manage" },
    { id: "nav-admin-api-keys",            label: "API Keys",                    href: "/admin/api-keys",                 icon: "bi-key",            permission: "access.manage" },
    { id: "nav-admin-localization",        label: "Localização",                 href: "/admin/localization",             icon: "bi-translate",      permission: "access.manage" },
    { id: "nav-admin-menus",               label: "Menus",                       href: "/admin/menus",                    icon: "bi-list-check",     permission: "access.manage" },
    { id: "nav-admin-tenant-config",       label: "Configurações",               href: "/admin/tenant-configuracao",      icon: "bi-gear",           permission: "access.manage" },
    { id: "nav-admin-logs",                label: "Logs",                        href: "/admin/logs",                     icon: "bi-journal-text",   permission: "access.manage" },
    { id: "nav-admin-operational-logs",    label: "Logs Operacionais",           href: "/admin/operational-logs",         icon: "activity",          permission: "access.manage" },
] as const;

/** Returns true if the permission set grants access to `key`. */
export function hasPermission(permissions: readonly string[], key: string): boolean {
    return permissions.includes("*") || permissions.includes(key);
}

/**
 * Builds the sidebar nav item list for a user based on their permission set.
 * Pass `me.permissions` from the BffMe object.
 */
export function buildNavItemsForPermissions(permissions: string[]): BffNavItem[] {
    return NAV_MANIFEST
        .filter((item) => hasPermission(permissions, item.permission))
        .map((item) => ({
            id: item.id,
            label: item.label,
            href: item.href,
            icon: item.icon,
            openInNewTab: false,
            children: [],
        }));
}
