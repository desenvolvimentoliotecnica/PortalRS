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
    { id: "nav-colaborador-perfil",        label: "Meu Perfil",                  href: "/colaborador/perfil",             icon: "user",             permission: "colaborador.perfil" },
    { id: "nav-colaborador-dependentes",   label: "Dependentes",                 href: "/colaborador/dependentes",        icon: "users",            permission: "colaborador.dependentes" },
    { id: "nav-colaborador-ferias",        label: "Férias",                      href: "/colaborador/ferias",             icon: "palmtree",         permission: "colaborador.ferias" },
    { id: "nav-colaborador-beneficios",    label: "Benefícios",                  href: "/colaborador/beneficios",         icon: "heart",            permission: "colaborador.beneficios" },
    { id: "nav-colaborador-endereco",      label: "Endereço",                    href: "/colaborador/endereco",           icon: "map-pin",          permission: "colaborador.endereco" },

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
    { id: "nav-promocoes",                 label: "Promoções",                   href: "/gestao/promocoes",               icon: "trending-up",      permission: "gestao.planos" },
    { id: "nav-planos-desenvolvimento",    label: "PDI",                         href: "/gestao/planosdesenvolvimento",   icon: "lines",            permission: "feedback.desenvolvimento" },
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
    { id: "nav-funcionarios",              label: "Funcionários",                href: "/funcionarios",                   icon: "users",            permission: "funcionarios.view" },
    { id: "nav-relatorios",                label: "Relatórios",                  href: "/relatorios",                     icon: "pie-chart",        permission: "relatorios.view" },

    // ── Admin ──────────────────────────────────────────────────────────
    { id: "nav-configuracao-aprovacoes",   label: "Configuração de Aprovações",  href: "/admin/configuracao-aprovacoes",  icon: "settings2",        permission: "access.manage" },
    { id: "nav-aprovadores-alternativos",  label: "Aprovadores Alternativos",    href: "/admin/aprovadores-alternativos", icon: "user-check",       permission: "access.manage" },
    { id: "nav-admin-users",               label: "Usuários",                    href: "/admin/users",                    icon: "users",            permission: "users.read" },
    { id: "nav-admin-roles",               label: "Perfis (Roles)",              href: "/admin/roles",                    icon: "shield",           permission: "roles.manage" },
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
