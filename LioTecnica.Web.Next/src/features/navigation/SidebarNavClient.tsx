"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronRight,
  Clock,
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
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { BffNavItem } from "@/lib/schemas/bff";

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
  "bi-bar-chart": BarChart3,
  // Fallback plain names
  brain: Brain,
  building2: Building2,
  briefcase: Briefcase,
  layoutdashboard: LayoutDashboard,
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
  "/feedback/pesquisarapida": "/feedback/pesquisarapida",
  "/feedback/pesquisas": "/feedback/pesquisas",
  "/feedback/reunioes1a1": "/feedback/reunioes1a1",
  "/feedback/superpesquisa": "/feedback/superpesquisa",
  // Gestão sub-routes (Razor uses PascalCase, Next.js lowercase)
  "/gestao/dashboard": "/gestao/dashboard",
  "/gestao/humor": "/gestao/humor",
  "/gestao/planosdesenvolvimento": "/gestao/planosdesenvolvimento",
  "/gestao/resumoatividades": "/gestao/resumoatividades",
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
type ModuleKey = "Recrutamento" | "Cadastros" | "Relatórios" | "Feedback" | "Admin" | "Owner";
const MODULE_ORDER: ModuleKey[] = ["Recrutamento", "Cadastros", "Relatórios", "Feedback", "Admin", "Owner"];

const RECRUTAMENTO_ROUTES = new Set([
  "/dashboard", "/agendas", "/vagas", "/candidatos",
  "/talentos", "/triagem", "/matching", "/portalvagas", "/entradaemailpasta",
]);
const CADASTROS_ROUTES = new Set([
  "/departamentos", "/areas", "/categorias", "/cargos",
  "/unidades", "/funcionarios", "/pessoas",
]);
const HIDDEN_ROUTES = new Set(["/matching", "/departamentos"]);

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
  if (r.startsWith("/feedback") || r.startsWith("/gestao") || r.startsWith("/desempenho")) return "Feedback";
  if (RECRUTAMENTO_ROUTES.has(r)) return "Recrutamento";
  if (CADASTROS_ROUTES.has(r) || r.startsWith("/cadastro/")) return "Cadastros";
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
  collapsed = false,
}: {
  item: BffNavItem;
  normalized: string;
  indent?: boolean;
  collapsed?: boolean;
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
        title={collapsed ? item.label : undefined}
        className={cn(
          "group flex items-center rounded-xl text-[0.88rem] leading-snug text-white/80",
          "border border-transparent transition-all duration-200",
          "hover:bg-white/10 hover:border-white/12 hover:text-white",
          active && "bg-white/[.16] border-white/[.22] text-white font-medium",
          collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
          indent && !collapsed && "ml-5 text-[0.82rem] py-1.5",
        )}
        href={href}
        rel={rel}
        target={target}
      >
        <Icon
          aria-hidden
          className={cn(
            "shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100",
            collapsed ? "size-5" : indent ? "size-[18px]" : "size-5",
            active && "opacity-100",
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
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
  collapsed = false,
  openGroups,
  onGroupOpenChange,
}: {
  item: BffNavItem;
  normalized: string;
  collapsed?: boolean;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
}) {
  const hasActive = hasActiveDescendant(item, normalized);
  const iconKey = (item.icon ?? "").toLowerCase();
  const Icon = ICONS[iconKey] ?? DEFAULT_ICON;

  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length === 0) {
    return <NavLeaf item={item} normalized={normalized} collapsed={collapsed} />;
  }

  const isOpen = openGroups?.[item.id] ?? hasActive;

  const handleToggle = () => {
    onGroupOpenChange?.(item.id, !isOpen);
  };

  if (collapsed) {
    if (!isOpen) {
      const firstChild = visibleChildren[0]!;
      const firstHref = normalizeHref(firstChild.href || "#");
      return (
        <li>
          <Link
            title={item.label}
            href={firstHref}
            className={cn(
              "group flex justify-center rounded-xl p-2.5 text-white/80",
              "border border-transparent transition-all duration-200",
              "hover:bg-white/10 hover:border-white/12 hover:text-white",
              hasActive && "bg-white/[.16] border-white/[.22] text-white",
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0 opacity-80 group-hover:opacity-100" />
          </Link>
        </li>
      );
    }
    return (
      <>
        {visibleChildren.map((c) =>
          c.children?.length ? (
            <NavGroup
              key={c.id}
              item={c}
              normalized={normalized}
              collapsed
              openGroups={openGroups}
              onGroupOpenChange={onGroupOpenChange}
            />
          ) : (
            <NavLeaf key={c.id} item={c} normalized={normalized} collapsed />
          ),
        )}
      </>
    );
  }

  return (
    <li>
      <button
        type="button"
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[0.88rem] leading-snug text-white/80",
          "border border-transparent transition-all duration-200",
          "hover:bg-white/10 hover:border-white/12 hover:text-white",
          isOpen && "text-white/95",
        )}
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
  collapsed = false,
  openGroups,
  onGroupOpenChange,
}: {
  item: BffNavItem;
  normalized: string;
  collapsed?: boolean;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
}) {
  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length > 0) {
    return (
      <NavGroup
        item={item}
        normalized={normalized}
        collapsed={collapsed}
        openGroups={openGroups}
        onGroupOpenChange={onGroupOpenChange}
      />
    );
  }
  return <NavLeaf item={item} normalized={normalized} collapsed={collapsed} />;
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
  collapsed = false,
  openGroups,
  onGroupOpenChange,
}: {
  label: string;
  items: BffNavItem[];
  normalized: string;
  moduleOpen: boolean;
  onModuleOpenChange: (open: boolean) => void;
  collapsed?: boolean;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
}) {
  if (items.length === 0) return null;

  if (collapsed) {
    // Regra primordial: quando retraído, exibir APENAS os itens do grupo da aba atual
    if (!moduleOpen) return null;
    return (
      <div className="mt-1">
        <ul className="space-y-0.5 pb-1">
          {items.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              normalized={normalized}
              collapsed
              openGroups={openGroups}
              onGroupOpenChange={onGroupOpenChange}
            />
          ))}
        </ul>
      </div>
    );
  }

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

function collectOpenGroups(items: BffNavItem[], normalized: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  function walk(list: BffNavItem[]) {
    for (const item of list) {
      const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
      if (visibleChildren.length > 0) {
        out[item.id] = hasActiveDescendant(item, normalized);
        walk(visibleChildren);
      }
    }
  }
  walk(items);
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR NAV — main export
   ═══════════════════════════════════════════════════════════════════ */
export default function SidebarNavClient({ items, collapsed = false }: { items: BffNavItem[]; collapsed?: boolean }) {
  const pathname = usePathname();
  const normalized = pathname.replace(/^\/app(?=\/|$)/, "") || "/";

  const grouped = useMemo(() => {
    const map: Record<ModuleKey, BffNavItem[]> = {
      Recrutamento: [],
      Cadastros: [],
      "Relatórios": [],
      Feedback: [],
      Admin: [],
      Owner: [],
    };
    for (const item of items) {
      if (isRouteHidden(item.href)) continue;
      const key = getModuleKey(item.href, item.children);
      map[key].push(item);
    }
    return map;
  }, [items]);

  const activeModule = useMemo<ModuleKey>(() => {
    for (const mod of MODULE_ORDER) {
      for (const item of grouped[mod]) {
        if (hasActiveDescendant(item, normalized)) return mod;
      }
    }
    return MODULE_ORDER.find((m) => grouped[m].length > 0) ?? "Recrutamento";
  }, [grouped, normalized]);

  const initialOpenGroups = useMemo(() => collectOpenGroups(items, normalized), [items, normalized]);

  const [openModules, setOpenModules] = useState<Record<ModuleKey, boolean>>(() => {
    const o: Record<ModuleKey, boolean> = {} as Record<ModuleKey, boolean>;
    for (const mod of MODULE_ORDER) {
      o[mod] = mod === activeModule;
    }
    return o;
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpenGroups);
  const prevCollapsed = useRef(collapsed);

  useEffect(() => {
    setOpenModules((p) => ({ ...p, [activeModule]: true }));
    setOpenGroups((prev) => ({ ...initialOpenGroups, ...prev }));
  }, [normalized, activeModule, initialOpenGroups]);

  // Ao voltar com o mouse (expandir após retrair): fechar outras tabs e deixar só a da aba atual
  useEffect(() => {
    if (prevCollapsed.current && !collapsed) {
      const next: Record<ModuleKey, boolean> = {} as Record<ModuleKey, boolean>;
      for (const mod of MODULE_ORDER) {
        next[mod] = mod === activeModule;
      }
      setOpenModules(next);
      setOpenGroups(initialOpenGroups);
    }
    prevCollapsed.current = collapsed;
  }, [collapsed, activeModule, initialOpenGroups]);

  const handleModuleOpenChange = useCallback((mod: ModuleKey) => (open: boolean) => {
    setOpenModules((p) => ({ ...p, [mod]: open }));
  }, []);

  const handleGroupOpenChange = useCallback((id: string, open: boolean) => {
    setOpenGroups((p) => ({ ...p, [id]: open }));
  }, []);

  const itemsKey = items.map((i) => i.id).join(",");

  return (
    <nav className={cn("pb-4 pt-1", collapsed ? "px-1" : "px-2")}>
      {MODULE_ORDER.map((mod) => (
        <ModuleSection
          key={`${mod}-${itemsKey}`}
          label={mod}
          items={grouped[mod]}
          normalized={normalized}
          moduleOpen={collapsed ? mod === activeModule : (openModules[mod] ?? mod === activeModule)}
          onModuleOpenChange={handleModuleOpenChange(mod)}
          collapsed={collapsed}
          openGroups={openGroups}
          onGroupOpenChange={handleGroupOpenChange}
        />
      ))}
    </nav>
  );
}
