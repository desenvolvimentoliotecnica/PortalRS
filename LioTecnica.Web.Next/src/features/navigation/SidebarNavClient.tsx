"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookCheck,
  BookOpen,
  Brain,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Clock,
  FileUp,
  Filter,
  Gauge,
  Globe,
  Heart,
  Home,
  Inbox,
  Key,
  KeyRound,
  Languages,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquare,
  Network,
  NotebookPen,
  Search,
  SearchCheck,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Tags,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { BffNavItem } from "@/lib/schemas/bff";
import { prefetchScreenData } from "@/lib/screenCache";
import {
  RECRUITMENT_LINEAR_ORDER,
  RECRUITMENT_ROUTE_KEYS,
  RECRUITMENT_ROUTE_LABELS,
  toNavRouteKey,
} from "@/features/navigation/recruitmentNavigation";

/* ═══════════════════════════════════════════════════════════════════
   ICON MAP: Bootstrap Icon name → Lucide equivalent
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULT_ICON: LucideIcon = BarChart3;
const ICONS: Record<string, LucideIcon> = {
  // Recrutamento
  "bi-speedometer2": Gauge,
  "bi-calendar-event": Calendar,
  "bi-briefcase": Briefcase,
  "bi-people": Users,
  "bi-person-plus": UserPlus,
  "bi-funnel": Filter,
  "bi-stars": Sparkles,
  "bi-inbox": Inbox,
  "bi-globe": Globe,
  // Feedback
  "bi-balloon-heart": Heart,
  "bi-house": Home,
  "bi-journal-plus": NotebookPen,
  "bi-send": Send,
  "bi-chat-quote": MessageSquare,
  "bi-trophy": Trophy,
  "bi-clock-history": Clock,
  "bi-search": Search,
  "bi-search-heart": SearchCheck,
  "bi-person-badge": Building2,
  "bi-journal-check": BookCheck,
  "bi-emoji-smile": Smile,
  "bi-activity": Activity,
  // Cadastros
  "bi-graph-up": TrendingUp,
  "bi-diagram-2": Network,
  "bi-diagram-3": Network,
  "bi-tags": Tags,
  "bi-building": Building,
  "bi-person-x": UserX,
  // Admin
  "bi-shield-lock": ShieldCheck,
  "bi-list-check": ListChecks,
  "bi-key": Key,
  "bi-key-fill": KeyRound,
  "bi-journal-text": BookOpen,
  "bi-envelope-paper": Mail,
  "bi-envelope": Mail,
  "bi-gear": Settings,
  "bi-microsoft": Globe,
  "bi-translate": Languages,
  "bi-check2-square": CheckSquare,
  "bi-bar-chart": BarChart3,
  // Fallback plain names
  brain: Brain,
  building2: Building2,
  briefcase: Briefcase,
  globe: Globe,
  layoutdashboard: LayoutDashboard,
  // New features
  fileup: FileUp,
  clipboardlist: ClipboardList,
  listchecks: ListChecks,
  usercheck: UserCheck,
};

/* ═══════════════════════════════════════════════════════════════════
   ROUTE MAP: Razor nested paths → flat Next.js routes
   ═══════════════════════════════════════════════════════════════════ */
const ROUTE_MAP: Record<string, string> = {
  // Cadastros
  "/cadastro/cargos": "/cargos",
  "/cadastro/unidades": "/unidades",
  "/cadastro/funcionarios": "/funcionarios",
  "/cadastro/categorias": "/categorias",
  "/cadastro/areas": "/areas",
  "/cadastro/departamentos": "/departamentos",
  "/cadastro/pessoas": "/pessoas",
  "/cadastro/funcoes": "/cadastro/funcoes",
  // Feedback sub-routes (Razor uses /Feedback/XYZ, Next.js uses /feedback/xyz)
  "/candidatos/detalhes": "/candidatos/detalhes",
  "/feedback/celebracao": "/feedback/celebracao",
  "/feedback/enviar": "/feedback/enviar",
  "/feedback/feedbacks": "/feedback/feedbacks",
  "/feedback/gamificacao": "/feedback/gamificacao",
  "/feedback/gamificacaohistorico": "/feedback/gamificacao/historico",
  "/feedback/gestao": "/feedback/gestao",
  "/feedback/meusplanos": "/feedback/meusplanos",
  "/feedback/pesquisas": "/feedback/pesquisas",
  "/feedback/pesquisarapida": "/feedback/pesquisas",
  "/feedback/superpesquisa": "/feedback/pesquisas",
  "/feedback/reunioes1a1": "/feedback/reunioes1a1",
  // Gestão sub-routes (Razor uses PascalCase, Next.js lowercase)
  "/gestao/dashboard": "/gestao/dashboard",
  "/gestao/humor": "/gestao/humor",
  "/gestao/planosdesenvolvimento": "/gestao/planosdesenvolvimento",
  "/gestao/resumoatividades": "/gestao/resumoatividades",
  "/gestao/solicitacoes": "/gestao/solicitacoes",
  "/gestao/pipeline": "/gestao/projetos",
  "/gestao/aprovacoes": "/gestao/aprovacoes",
  "/gestao/batida-ponto": "/gestao/batida-ponto",
  "/gestao/comissoes": "/gestao/comissoes",
  "/portalvagas": "/PortalVagas",
  "/portalvagas/acesso": "/PortalVagas/Acesso",
  // Novas rotas (Sprints 3-6)
  "/gestao/projetos": "/gestao/projetos",
  "/gestao/processo-seletivo": "/gestao/processo-seletivo",
  // Admissão
  "/admissao": "/admissao",
  // Colaborador
  "/colaborador/dependentes": "/colaborador/dependentes",
  // Desempenho sub-routes
  "/desempenho/minhasavaliacoes": "/desempenho",
  // Admin
  "/admin/users": "/admin/users",
  "/admin/roles": "/admin/roles",
  "/admin/accesses": "/admin/accesses",
  "/admin/menus": "/admin/menus",
  "/admin/logs": "/admin/logs",
  "/admin/operationallogs": "/admin/operational-logs",
  "/admin/emails": "/admin/emails",
  "/admin/emailconfig": "/admin/email-config",
  "/admin/emailtemplates": "/admin/email-templates",
  "/admin/apikeys": "/admin/api-keys",
  "/admin/entraidconfig": "/admin/entra-id",
  "/admin/localizationconfig": "/admin/localization",
  // Hierarquia/Organograma unificado (antigas telas separadas → página com abas)
  "/admin/hierarquia": "/admin/organograma",
  "/admin/gestores": "/admin/organograma",
  "/admin/organograma": "/admin/organograma",
  "/admin/regrasaprovacaovaga": "/admin/organograma",
  "/admin/regras-aprovacao-vaga": "/admin/organograma",
};

function normalizeHref(raw: string): string {
  if (!raw || raw === "#") return "#";
  // /Owner/Tenants/{tenantId} -> /Owner/Tenants?id={tenantId} (compat com static export)
  const ownerTenantMatch = raw.match(/^\/Owner\/Tenants\/([^/?#]+)\/?$/i);
  if (ownerTenantMatch) return `/Owner/Tenants?id=${encodeURIComponent(ownerTenantMatch[1])}`;
  if (raw.startsWith("/Owner") || raw.startsWith("/owner")) return raw;
  const lower = raw.toLowerCase().replace(/\/+$/, "");
  return ROUTE_MAP[lower] ?? lower;
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE CLASSIFICATION (mirrors Razor GetModuleKey)
   ═══════════════════════════════════════════════════════════════════ */
type ModuleKey = "Recrutamento" | "Cadastros" | "Relatórios" | "Gestão de Pessoas" | "Operacional" | "Feedback" | "Admin" | "Owner";
const MODULE_ORDER: ModuleKey[] = ["Recrutamento", "Operacional", "Gestão de Pessoas", "Cadastros", "Relatórios", "Feedback", "Admin", "Owner"];

// Fluxo linear de recrutamento — Dashboard + 7 passos visíveis no sidebar
const RECRUTAMENTO_ROUTES = new Set<string>([
  RECRUITMENT_ROUTE_KEYS.dashboard,
  RECRUITMENT_ROUTE_KEYS.solicitacoes,
  RECRUITMENT_ROUTE_KEYS.vagas,
  RECRUITMENT_ROUTE_KEYS.candidatos,
  RECRUITMENT_ROUTE_KEYS.matching,
  RECRUITMENT_ROUTE_KEYS.triagem,
  RECRUITMENT_ROUTE_KEYS.processoSeletivo,
  RECRUITMENT_ROUTE_KEYS.admissao,
]);
// Operacional (dia a dia)
const OPERACIONAL_ROUTES = new Set([
  "/agendas", "/entradaemailpasta",
  "/gestao/batida-ponto", "/gestao/comissoes",
]);
const CADASTROS_ROUTES = new Set([
  "/departamentos", "/areas", "/categorias", "/cargos",
  "/unidades", "/funcionarios", "/pessoas",
  "/colaborador/dependentes",
]);
// Gestão de Pessoas (people management, não recrutamento)
const GESTAO_PESSOAS_ROUTES = new Set([
  "/gestao/dashboard", "/gestao/planosdesenvolvimento",
  "/gestao/humor", "/gestao/resumoatividades",
]);
const HIDDEN_ROUTES = new Set([
  "/departamentos", "/gestao/pipeline",
  "/gestao/aprovacoes",
  "/portalvagas",
  "/talentos",
  "/gestao/projetos",
  // Pesquisas antigas removidas — unificadas em /feedback/pesquisas
  "/feedback/pesquisarapida",
  "/feedback/superpesquisa",
]);

function getModuleKey(href: string, children?: BffNavItem[]): ModuleKey {
  if (!href || href === "#") {
    if (children?.length) {
      for (const child of children) {
        const childModule = getModuleKey(child.href, child.children);
        if (childModule !== "Recrutamento") return childModule;
      }
    }
    return "Recrutamento";
  }
  const r = href.replace(/\/+$/, "").toLowerCase();
  if (r.startsWith("/owner")) return "Owner";
  if (r.startsWith("/admin")) return "Admin";
  if (r === "/relatorios") return "Relatórios";
  if (r === "/pesquisas") return "Feedback";
  if (r.startsWith("/feedback") || r.startsWith("/desempenho")) return "Feedback";
  if (RECRUTAMENTO_ROUTES.has(r)) return "Recrutamento";
  if (OPERACIONAL_ROUTES.has(r)) return "Operacional";
  if (GESTAO_PESSOAS_ROUTES.has(r)) return "Gestão de Pessoas";
  if (CADASTROS_ROUTES.has(r) || r.startsWith("/cadastro/")) return "Cadastros";
  // Fallback: any /gestao/* not matched goes to Recrutamento (new screens)
  if (r.startsWith("/gestao")) return "Recrutamento";
  return "Recrutamento";
}

function isRouteHidden(href: string): boolean {
  return HIDDEN_ROUTES.has(href.replace(/\/+$/, "").toLowerCase());
}

/** Check if a normalized pathname matches a given href — apenas correspondência exata para evitar múltiplos itens selecionados */
function isActive(normalized: string, href: string): boolean {
  const n = normalized.toLowerCase().replace(/\/+$/, "") || "/";
  const h = href.toLowerCase().replace(/\/+$/, "");
  if (h === "#" || h === "") return false;
  return n === h;
}

/** Check if any item or its children are active */
function hasActiveDescendant(item: BffNavItem, normalized: string): boolean {
  const href = normalizeHref(item.href);
  if (isActive(normalized, href)) return true;
  return item.children?.some((c) => hasActiveDescendant(c, normalized)) ?? false;
}

function cloneNavItem(item: BffNavItem, overrides: Partial<BffNavItem> = {}): BffNavItem {
  return {
    ...item,
    ...overrides,
    children: overrides.children ?? item.children.map((child) => cloneNavItem(child)),
  };
}

function normalizeRecruitmentItem(item: BffNavItem): BffNavItem {
  const routeKey = toNavRouteKey(item.href);
  return cloneNavItem(item, {
    href: normalizeHref(item.href || "#"),
    label: RECRUITMENT_ROUTE_LABELS[routeKey] ?? item.label,
  });
}

/**
 * Constrói o sidebar de recrutamento como lista linear (sem accordions).
 * Segue a ordem definida em RECRUITMENT_LINEAR_ORDER:
 * Solicitações → Vagas → Candidatos → Matching → Triagem → Processo Seletivo → Admissão
 */
function buildRecruitmentSidebar(items: BffNavItem[]): BffNavItem[] {
  const known = new Map<string, BffNavItem>();
  const leftovers: BffNavItem[] = [];

  function collect(list: BffNavItem[]) {
    for (const item of list) {
      if ((!item.href || item.href === "#") && item.children.length > 0) {
        collect(item.children);
        continue;
      }

      const routeKey = toNavRouteKey(item.href);
      const normalizedItem = normalizeRecruitmentItem(item);

      if (routeKey !== "#" && RECRUTAMENTO_ROUTES.has(routeKey) && !known.has(routeKey)) {
        known.set(routeKey, normalizedItem);
        continue;
      }

      leftovers.push(normalizedItem);
    }
  }

  collect(items);

  // Lista linear seguindo a ordem do fluxo
  const result: BffNavItem[] = [];
  const used = new Set<string>();

  for (const routeKey of RECRUITMENT_LINEAR_ORDER) {
    const item = known.get(routeKey);
    if (!item) continue;
    used.add(routeKey);
    result.push(cloneNavItem(item, { children: [] }));
  }

  // Itens conhecidos que não estão no linear order (safety net)
  const remaining = Array.from(known.entries())
    .filter(([key]) => !used.has(key))
    .map(([, item]) => cloneNavItem(item, { children: [] }));

  return [...result, ...remaining, ...leftovers];
}

/* ═══════════════════════════════════════════════════════════════════
   COLLAPSIBLE SECTION — CSS grid-template-rows animation
   ═══════════════════════════════════════════════════════════════════ */
function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 250ms cubic-bezier(.4,0,.2,1)",
      }}
    >
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NAV LINK — leaf item (no children)
   ═══════════════════════════════════════════════════════════════════ */
function NavLeaf({
  item,
  normalized,
  indent = false,
}: {
  item: BffNavItem;
  normalized: string;
  indent?: boolean;
}) {
  const href = normalizeHref(item.href || "#");
  const active = isActive(normalized, href);
  const iconKey = (item.icon ?? "").toLowerCase();
  const Icon = ICONS[iconKey] ?? DEFAULT_ICON;
  const target = item.openInNewTab ? "_blank" : undefined;
  const rel = item.openInNewTab ? "noopener noreferrer" : undefined;

  return (
    <li>
      <Link
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-xl text-[0.88rem] leading-snug text-white/80",
          "border border-transparent transition-all duration-200",
          "hover:bg-white/10 hover:border-white/12 hover:text-white",
          active && "bg-white/[.16] border-white/[.22] text-white font-medium",
          indent && "ml-5 text-[0.82rem] py-1.5",
        )}
        href={href}
        rel={rel}
        target={target}
        onMouseEnter={() => void prefetchScreenData(href)}
      >
        <Icon
          aria-hidden
          className={cn(
            "shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100",
            indent ? "size-[18px]" : "size-5",
            active && "opacity-100",
          )}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NAV GROUP — item with children (sub-accordion)
   ═══════════════════════════════════════════════════════════════════ */
function NavGroup({
  item,
  normalized,
  openGroups,
  onGroupOpenChange,
}: {
  item: BffNavItem;
  normalized: string;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
}) {
  const href = normalizeHref(item.href || "#");
  const iconKey = (item.icon ?? "").toLowerCase();
  const Icon = ICONS[iconKey] ?? DEFAULT_ICON;
  const target = item.openInNewTab ? "_blank" : undefined;
  const rel = item.openInNewTab ? "noopener noreferrer" : undefined;

  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length === 0) {
    return <NavLeaf item={item} normalized={normalized} />;
  }

  const hasActive = hasActiveDescendant(item, normalized);
  const canNavigate = href !== "#";
  const isOpen = openGroups?.[item.id] ?? hasActive;

  const handleToggle = () => {
    onGroupOpenChange?.(item.id, !isOpen);
  };

  const headerClass = cn(
    "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[0.88rem] leading-snug text-white/80",
    "border border-transparent transition-all duration-200",
    "hover:bg-white/10 hover:border-white/12 hover:text-white",
    (isOpen || hasActive) && "bg-white/[.08] border-white/[.14] text-white/95",
  );

  return (
    <li>
      {canNavigate ? (
        <div className={headerClass}>
          <Link
            className="flex min-w-0 flex-1 items-center gap-3"
            href={href}
            rel={rel}
            target={target}
            onMouseEnter={() => void prefetchScreenData(href)}
          >
            <Icon aria-hidden className="size-5 shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
            <span className="truncate flex-1 text-left">{item.label}</span>
          </Link>
          <button
            type="button"
            className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isOpen ? `Fechar ${item.label}` : `Abrir ${item.label}`}
            onClick={handleToggle}
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-250",
                isOpen && "rotate-90",
              )}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={headerClass}
          onClick={handleToggle}
        >
          <Icon aria-hidden className="size-5 shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
          <span className="truncate flex-1 text-left">{item.label}</span>
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 opacity-60 transition-transform duration-250",
              isOpen && "rotate-90",
            )}
          />
        </button>
      )}
      <Collapsible open={isOpen}>
        <ul className="mt-0.5 space-y-0.5">
          {visibleChildren.map((c) =>
            c.children?.length ? (
              <NavGroup key={c.id} item={c} normalized={normalized} openGroups={openGroups} onGroupOpenChange={onGroupOpenChange} />
            ) : (
              <NavLeaf key={c.id} item={c} normalized={normalized} indent />
            ),
          )}
        </ul>
      </Collapsible>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NAV ITEM — dispatcher: leaf or group
   ═══════════════════════════════════════════════════════════════════ */
function NavItem({
  item,
  normalized,
  openGroups,
  onGroupOpenChange,
}: {
  item: BffNavItem;
  normalized: string;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
}) {
  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length > 0) {
    return (
      <NavGroup
        item={item}
        normalized={normalized}
        openGroups={openGroups}
        onGroupOpenChange={onGroupOpenChange}
      />
    );
  }
  return <NavLeaf item={item} normalized={normalized} />;
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE SECTION — top-level accordion (RECRUTAMENTO, CADASTROS, etc.)
   ═══════════════════════════════════════════════════════════════════ */
function ModuleSection({
  label,
  items,
  normalized,
  moduleOpen,
  onModuleOpenChange,
  openGroups,
  onGroupOpenChange,
}: {
  label: string;
  items: BffNavItem[];
  normalized: string;
  moduleOpen: boolean;
  onModuleOpenChange: (open: boolean) => void;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-1">
      {/* Module header */}
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2",
          "text-[0.72rem] font-bold tracking-[0.16em] text-white/85 uppercase",
          "transition-colors duration-200 hover:bg-white/[.08] hover:text-white",
        )}
        onClick={() => onModuleOpenChange(!moduleOpen)}
      >
        <span>{label}</span>
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 opacity-60 transition-transform duration-250",
            moduleOpen && "rotate-90",
          )}
        />
      </button>

      {/* Module body */}
      <Collapsible open={moduleOpen}>
        <ul className="space-y-0.5 pb-1">
          {items.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              normalized={normalized}
              openGroups={openGroups}
              onGroupOpenChange={onGroupOpenChange}
            />
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR NAV — main export (optimised: synchronous state, no flash)
   ═══════════════════════════════════════════════════════════════════ */
export default function SidebarNavClient({ items }: { items: BffNavItem[] }) {
  const pathname = usePathname();
  const normalized = pathname.replace(/^\/app(?=\/|$)/, "") || "/";

  // ── 1. Group items by module (only recomputes when items change) ──
  const grouped = useMemo(() => {
    const map: Record<ModuleKey, BffNavItem[]> = {
      Recrutamento: [],
      "Operacional": [],
      "Gestão de Pessoas": [],
      Cadastros: [],
      "Relatórios": [],
      Feedback: [],
      Admin: [],
      Owner: [],
    };
    for (const item of items) {
      if (isRouteHidden(item.href)) continue;
      const key = getModuleKey(item.href, item.children);
      // Flatten: if item is a group header (href="#") push children directly
      if ((!item.href || item.href === "#") && item.children?.length) {
        for (const child of item.children) {
          if (!isRouteHidden(child.href)) {
            const childKey = getModuleKey(child.href, child.children);
            map[childKey].push(child);
          }
        }
      } else {
        map[key].push(item);
      }
    }
    map.Recrutamento = buildRecruitmentSidebar(map.Recrutamento);
    return map;
  }, [items]);

  const renderedItems = useMemo(
    () => MODULE_ORDER.flatMap((mod) => grouped[mod]),
    [grouped],
  );

  // ── 2. Detect which module owns the current route ──
  const activeModule = useMemo<ModuleKey>(() => {
    for (const mod of MODULE_ORDER) {
      for (const item of grouped[mod]) {
        if (hasActiveDescendant(item, normalized)) return mod;
      }
    }
    return MODULE_ORDER.find((m) => grouped[m].length > 0) ?? "Recrutamento";
  }, [grouped, normalized]);

  // ── 3. Module open/close: synchronous, no useEffect ──
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, boolean>>({});
  const prevActiveModule = useRef(activeModule);

  if (prevActiveModule.current !== activeModule) {
    prevActiveModule.current = activeModule;
    if (Object.keys(moduleOverrides).length > 0) {
      setModuleOverrides({});
    }
  }

  const resolvedModuleOpen = useMemo(() => {
    const out: Record<ModuleKey, boolean> = {} as Record<ModuleKey, boolean>;
    for (const mod of MODULE_ORDER) {
      if (mod in moduleOverrides) {
        out[mod] = moduleOverrides[mod as string];
      } else {
        out[mod] = mod === activeModule;
      }
    }
    return out;
  }, [activeModule, moduleOverrides]);

  const handleModuleOpenChange = useCallback((mod: ModuleKey) => (open: boolean) => {
    setModuleOverrides((p) => ({ ...p, [mod]: open }));
  }, []);

  // ── 4. Sub-group open/close: same synchronous pattern ──
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({});
  const prevNormalized = useRef(normalized);

  if (prevNormalized.current !== normalized) {
    prevNormalized.current = normalized;
    if (Object.keys(groupOverrides).length > 0) {
      setGroupOverrides({});
    }
  }

  const resolvedOpenGroups = useMemo(() => {
    const base: Record<string, boolean> = {};
    function walk(list: BffNavItem[]) {
      for (const item of list) {
        const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
        if (visibleChildren.length > 0) {
          base[item.id] = hasActiveDescendant(item, normalized);
          walk(visibleChildren);
        }
      }
    }
    walk(renderedItems);
    return { ...base, ...groupOverrides };
  }, [renderedItems, normalized, groupOverrides]);

  const handleGroupOpenChange = useCallback((id: string, open: boolean) => {
    setGroupOverrides((p) => ({ ...p, [id]: open }));
  }, []);

  // ── 5. Render ──
  return (
    <nav className="pb-4 pt-1 px-2">
      {MODULE_ORDER.map((mod) => (
        <ModuleSection
          key={mod}
          label={mod}
          items={grouped[mod]}
          normalized={normalized}
          moduleOpen={resolvedModuleOpen[mod]}
          onModuleOpenChange={handleModuleOpenChange(mod)}
          openGroups={resolvedOpenGroups}
          onGroupOpenChange={handleGroupOpenChange}
        />
      ))}
    </nav>
  );
}

