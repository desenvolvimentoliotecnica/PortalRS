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
    { id: "nav-painel-solicitacoes",       label: "Painel de Solicitações",      href: "/gestao/painel-solicitacoes",     icon: "gitbranch",        permission: "gestao.dashboard" },
    { id: "nav-gestao-solicitacoes-vaga",  label: "Solicitações de Vaga",        href: "/gestao/solicitacoes",          icon: "clipboardlist",     permission: "solicitacoes-vaga.view" },
    { id: "nav-gestao-aprovacoes-vaga",    label: "Aprovações",                   href: "/gestao/aprovacoes",            icon: "listchecks",        permission: "aprovacoes-vaga.view" },
    { id: "nav-agendas",                   label: "Agenda",                     href: "/agendas",                        icon: "calendar",         permission: "agenda.view" },

    // ── Colaborador ────────────────────────────────────────────────────
    { id: "nav-colab-perfil",          label: "Dados Pessoais",        href: "/colaborador/perfil",             icon: "user",          permission: "colaborador.perfil" },
    { id: "nav-colab-dependentes",     label: "Dependentes",           href: "/colaborador/dependentes",        icon: "users",         permission: "colaborador.dependentes" },
    { id: "nav-colab-endereco",        label: "Endereço",              href: "/colaborador/endereco",           icon: "map-pin",       permission: "colaborador.endereco" },
    { id: "nav-colab-dados-bancarios", label: "Dados Bancários",       href: "/colaborador/dados-bancarios",    icon: "credit-card",   permission: "colaborador.perfil" },
    { id: "nav-colab-ferias",          label: "Férias",                href: "/colaborador/ferias",             icon: "palmtree",      permission: "colaborador.ferias" },
    { id: "nav-colab-beneficios",      label: "Benefícios",            href: "/colaborador/beneficios",         icon: "heart",         permission: "colaborador.beneficios" },
    { id: "nav-colab-holerites",       label: "Holerites",             href: "/colaborador/holerites",          icon: "receipt",       permission: "colaborador.perfil" },
    { id: "nav-colab-documentos",      label: "Documentos",            href: "/colaborador/documentos",         icon: "file-text",     permission: "colaborador.documentos" },
    { id: "nav-colab-historico",       label: "Histórico de Carreira", href: "/colaborador/historico-carreira", icon: "briefcase",     permission: "colaborador.perfil" },
    { id: "nav-colab-senha",           label: "Alterar Senha",         href: "/colaborador/senha",              icon: "lock",          permission: "colaborador.senha" },

    // ── Recrutamento & Seleção ─────────────────────────────────────────
    { id: "nav-vagas",                     label: "Vagas",                       href: "/vagas",                          icon: "briefcase",        permission: "vagas.view" },
    { id: "nav-candidatos",                label: "Candidatos",                  href: "/candidatos",                     icon: "users",            permission: "candidatos.view" },
    { id: "nav-triagem",                   label: "Candidaturas",                href: "/recrutamento/candidaturas",      icon: "bi-funnel",        permission: "triagem.view" },
    { id: "nav-propostas-vaga",            label: "Propostas",                   href: "/recrutamento/propostas-vaga",    icon: "file-text",        permission: "propostas-vaga.view" },
    { id: "nav-rh-contrat-triagem",        label: "Contratações — Triagem",      href: "/rh/contratacoes/triagem",        icon: "clipboardlist",      permission: "rh.contratacoes.triagem" },
    { id: "nav-rh-contrat-selecao",        label: "Contratações — Seleção",       href: "/rh/contratacoes/selecao",        icon: "usercheck",          permission: "rh.contratacoes.selecao" },
    { id: "nav-rh-contrat-aprovacoes",    label: "Contratações — Aprovações",     href: "/gestao/aprovacoes",            icon: "listchecks",          permission: "gestao.dashboard" },
    { id: "nav-processo-seletivo",         label: "Processo Seletivo",           href: "/gestao/processo-seletivo",       icon: "listchecks",       permission: "processo-seletivo.view" },
    { id: "nav-admissao",                  label: "Admissão",                    href: "/admissao",                       icon: "usercheck",        permission: "admissao.view" },
    { id: "nav-portalvagas",               label: "Portal de Vagas",             href: "/portalvagas",                    icon: "globe",            permission: "portalvagas.view" },
    { id: "nav-painel-rh",                 label: "Painel RH",                   href: "/painel-rh",                       icon: "layoutdashboard", permission: "entrada.view" },

    // ── Gestão de Pessoas & Feedback ───────────────────────────────────
    { id: "nav-gestao-dashboard",          label: "Dashboard Gestão",            href: "/gestao/dashboard",               icon: "layoutdashboard",  permission: "gestao.dashboard" },
    { id: "nav-meu-time",                  label: "Meu Time",                    href: "/gestao/meu-time",                icon: "users",            permission: "gestao.dashboard" },
    { id: "nav-batidaponto",               label: "Batida de Ponto",             href: "/gestao/batida-ponto",            icon: "bi-clock-history", permission: "agenda.view" }, // Reusing general view
    { id: "nav-comissoes",                 label: "Pagamento extra",             href: "/gestao/comissoes",               icon: "bi-bar-chart",     permission: "gestao.dashboard" },
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
    { id: "nav-funcoes",                   label: "Funções",                     href: "/funcoes",                        icon: "list-checks",      permission: "jobpositions.view" },
    { id: "nav-nivel-cargo",               label: "Cargos - Nível de Cargo",         href: "/nivel-cargo",                    icon: "layers",           permission: "jobpositions.view" },
    { id: "nav-unidades",                  label: "Unidades",                    href: "/unidades",                       icon: "map-pin",          permission: "units.view" },
    { id: "nav-centros-custo",             label: "Centros de Custo",            href: "/centros-custo",                  icon: "landmark",         permission: "areas.view" },
    { id: "nav-categorias-salariais",      label: "Categorias Salariais",        href: "/categorias-salariais",           icon: "badge-dollar-sign", permission: "categories.view" },
    { id: "nav-turnos",                    label: "Turnos",                      href: "/turnos",                         icon: "clock",            permission: "areas.view" },
    { id: "nav-sla-vagas",                label: "SLA de Vagas",                href: "/sla-vagas",                       icon: "timer",            permission: "vagas.view" },
    { id: "nav-motivos-requisicao",        label: "Motivos de Requisição",       href: "/motivos-requisicao",             icon: "list-checks",      permission: "units.view" },
    { id: "nav-pessoas",                   label: "Pessoas",                     href: "/pessoas",                        icon: "user",             permission: "funcionarios.view" },
    { id: "nav-funcionarios",              label: "Funcionários",                href: "/funcionarios",                   icon: "users",            permission: "funcionarios.view" },
    { id: "nav-bloqueiopessoa",            label: "Bloqueio de Pessoa",          href: "/bloqueiopessoa",                 icon: "user-x",           permission: "funcionarios.view" },
    { id: "nav-talentos",                  label: "Talentos",                    href: "/talentos",                       icon: "sparkles",         permission: "candidatos.view" },
    { id: "nav-relatorios",                label: "Relatórios",                  href: "/relatorios",                     icon: "pie-chart",        permission: "relatorios.view" },
    { id: "nav-relatorios-integracao-rm",  label: "Dashboard Integração RM",     href: "/relatorios/integracao-rm",       icon: "bi-bar-chart",     permission: "relatorios.view" },

    // ── Admin ──────────────────────────────────────────────────────────
    { id: "nav-admin-users",               label: "Usuários",                    href: "/admin/users",                    icon: "users",             permission: "users.read" },
    { id: "nav-admin-roles",               label: "Perfis (Roles)",              href: "/admin/roles",                    icon: "shield",            permission: "roles.manage" },
    { id: "nav-admin-logs",                label: "Logs operacionais",           href: "/admin/logs",                     icon: "activity",          permission: "logs.view" },
    { id: "nav-admin-accesses",            label: "Acessos",                     href: "/admin/accesses",                 icon: "bi-shield-lock",    permission: "access.manage" },
    { id: "nav-admin-organograma",         label: "Organograma",                 href: "/admin/organograma",              icon: "bi-diagram-2",      permission: "access.manage" },

    { id: "nav-admin-tenant-config",       label: "Configurações",               href: "/admin/tenant-configuracao",      icon: "bi-gear",           permission: "access.manage" },
    { id: "nav-admin-configuracao-rm",     label: "Configuração RM",             href: "/admin/configuracao-rm",          icon: "database",          permission: "access.manage" },
    { id: "nav-admin-ia",                  label: "Configuração de IA",          href: "/admin/ia",                       icon: "brain",             permission: "ai.config" },
    { id: "nav-admin-documentacao-padrao", label: "Documentação Padrão",         href: "/admin/documentacao-padrao",      icon: "file-text",         permission: "documentacao-padrao.manage" },
    { id: "nav-admin-integracao-totvs",    label: "Integração TOTVS",            href: "/integracao-totvs",               icon: "arrow-right-left",   permission: "access.manage" },
    { id: "nav-admin-requisicoes-rm",        label: "Requisições RM",               href: "/admin/requisicoes-rm",           icon: "clipboardlist",      permission: "access.manage" },
    { id: "nav-admin-rm-requisicao-status", label: "Status RM ⇄ Requisição",      href: "/admin/rm-requisicao-status",    icon: "arrow-right-left",   permission: "access.manage" },
    { id: "nav-admin-api-keys",            label: "Chaves de API",               href: "/admin/api-keys",                 icon: "bi-key-fill",       permission: "api-keys.manage" },
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
