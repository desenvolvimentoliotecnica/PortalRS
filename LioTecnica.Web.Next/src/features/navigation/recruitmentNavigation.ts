import type { BffMe, BffNavItem } from "@/lib/schemas/bff";

export const NAV_MENU_CACHE_KEY = "renderrh.nav.menus.v2";

export const RECRUITMENT_ROUTE_KEYS = {
  dashboard: "/dashboard",
  vagas: "/vagas",
  solicitacoes: "/gestao/solicitacoes",
  aprovacoes: "/gestao/aprovacoes",
  portalVagas: "/portalvagas",
  talentos: "/talentos",
  candidatos: "/candidatos",
  matching: "/matching",
  rodadas: "/gestao/projetos",
  processoSeletivo: "/gestao/processo-seletivo",
  triagem: "/triagem",
  admissao: "/admissao",
} as const;

/** Ordem linear do fluxo de recrutamento no sidebar. */
export const RECRUITMENT_LINEAR_ORDER = [
  RECRUITMENT_ROUTE_KEYS.dashboard,        // 0. Dashboard
  RECRUITMENT_ROUTE_KEYS.solicitacoes,     // 1. Solicitações (+ Aprovações)
  RECRUITMENT_ROUTE_KEYS.vagas,            // 2. Vagas
  RECRUITMENT_ROUTE_KEYS.candidatos,       // 3. Candidatos (+ Talentos)
  RECRUITMENT_ROUTE_KEYS.matching,         // 4. Matching IA
  RECRUITMENT_ROUTE_KEYS.triagem,          // 5. Triagem
  RECRUITMENT_ROUTE_KEYS.processoSeletivo, // 6. Processo Seletivo
  RECRUITMENT_ROUTE_KEYS.admissao,         // 7. Admissão
] as const;

export const RECRUITMENT_ROUTE_LABELS: Record<string, string> = {
  [RECRUITMENT_ROUTE_KEYS.dashboard]: "Dashboard",
  [RECRUITMENT_ROUTE_KEYS.vagas]: "Vagas",
  [RECRUITMENT_ROUTE_KEYS.solicitacoes]: "Solicitações",
  [RECRUITMENT_ROUTE_KEYS.aprovacoes]: "Aprovações",
  [RECRUITMENT_ROUTE_KEYS.portalVagas]: "Portal de Vagas",
  [RECRUITMENT_ROUTE_KEYS.talentos]: "Banco de Talentos",
  [RECRUITMENT_ROUTE_KEYS.candidatos]: "Candidatos",
  [RECRUITMENT_ROUTE_KEYS.matching]: "Matching IA",
  [RECRUITMENT_ROUTE_KEYS.rodadas]: "Rodadas de Seleção",
  [RECRUITMENT_ROUTE_KEYS.processoSeletivo]: "Processo Seletivo",
  [RECRUITMENT_ROUTE_KEYS.triagem]: "Triagem",
  [RECRUITMENT_ROUTE_KEYS.admissao]: "Admissão",
};

export const ADMIN_RECRUITMENT_ROUTE_PATTERNS = [
  RECRUITMENT_ROUTE_KEYS.dashboard,
  RECRUITMENT_ROUTE_KEYS.solicitacoes,
  RECRUITMENT_ROUTE_KEYS.aprovacoes,
  RECRUITMENT_ROUTE_KEYS.vagas,
  RECRUITMENT_ROUTE_KEYS.portalVagas,
  RECRUITMENT_ROUTE_KEYS.talentos,
  RECRUITMENT_ROUTE_KEYS.candidatos,
  RECRUITMENT_ROUTE_KEYS.matching,
  RECRUITMENT_ROUTE_KEYS.rodadas,
  RECRUITMENT_ROUTE_KEYS.processoSeletivo,
  RECRUITMENT_ROUTE_KEYS.triagem,
  RECRUITMENT_ROUTE_KEYS.admissao,
] as const;

const ROUTE_KEY_ALIASES: Record<string, string> = {
  "/gestao/pipeline": RECRUITMENT_ROUTE_KEYS.rodadas,
};

function createItem(id: string, label: string, href: string, icon: string): BffNavItem {
  return {
    id,
    label,
    href,
    icon,
    openInNewTab: false,
    children: [],
  };
}

export function toNavRouteKey(href: string | null | undefined): string {
  if (!href || href === "#") return "#";
  const withoutApp = href.replace(/^\/app(?=\/|$)/i, "");
  const trimmed = withoutApp.replace(/\/+$/, "") || "/";
  const lower = trimmed.toLowerCase();
  return ROUTE_KEY_ALIASES[lower] ?? lower;
}

export function collectNavRouteKeys(items: BffNavItem[]): Set<string> {
  const seen = new Set<string>();

  function walk(list: BffNavItem[]) {
    for (const item of list) {
      seen.add(toNavRouteKey(item.href));
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  }

  walk(items);
  return seen;
}

export function buildTenantExtraNavItems(me: BffMe): BffNavItem[] {
  const roleSet = new Set((me.roles ?? []).map((role) => role.toLowerCase()));
  const isAdmin = me.isAdmin;
  const isGestor = isAdmin || roleSet.has("gestor");

  const extras: BffNavItem[] = [
    createItem("nav-solicitacoes", "Solicitações", "/gestao/solicitacoes", "clipboardlist"),
    createItem("nav-processo-seletivo", "Processo Seletivo", "/gestao/processo-seletivo", "listchecks"),
    createItem("nav-admissao", "Admissão", "/admissao", "usercheck"),
    createItem("nav-admissao-integracao", "Integração TOTVS", "/admissao/integracao", "arrow-right-left"),
    createItem("nav-batidaponto", "Batida de Ponto", "/gestao/batida-ponto", "bi-clock-history"),
    createItem("nav-comissoes", "Pagamento extra", "/gestao/comissoes", "bi-bar-chart"),
  ];

  return extras.filter((item) => {
    if (item.href === RECRUITMENT_ROUTE_KEYS.solicitacoes) {
      return isGestor;
    }
    return true;
  });
}
