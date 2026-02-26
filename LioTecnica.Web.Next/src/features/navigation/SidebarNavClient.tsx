"use client";

import { useCallback, useMemo, useState } from "react";
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
import type { BffNavItem } from "@/server/bff/navigation.schema";

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
  "/cadastro/cargos": "/cargos",
  "/cadastro/unidades": "/unidades",
  "/cadastro/funcionarios": "/funcionarios",
  "/cadastro/categorias": "/categorias",
  "/cadastro/areas": "/areas",
  "/cadastro/departamentos": "/departamentos",
  "/cadastro/pessoas": "/pessoas",
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
const HIDDEN_ROUTES = new Set(["/matching"]);

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

/** Check if a normalized pathname matches a given href */
function isActive(normalized: string, href: string): boolean {
  const n = normalized.toLowerCase();
  const h = href.toLowerCase().replace(/\/+$/, "");
  if (h === "#" || h === "") return false;
  return n === h || (h.length > 1 && n.startsWith(`${h}/`));
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
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-[0.88rem] leading-snug text-white/80",
          "border border-transparent transition-all duration-200",
          "hover:bg-white/10 hover:border-white/12 hover:text-white",
          active && "bg-white/[.16] border-white/[.22] text-white font-medium",
          indent && "ml-5 text-[0.82rem] py-1.5",
        )}
        href={href}
        rel={rel}
        target={target}
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
function NavGroup({ item, normalized }: { item: BffNavItem; normalized: string }) {
  const hasActive = hasActiveDescendant(item, normalized);
  const [open, setOpen] = useState(hasActive);
  const iconKey = (item.icon ?? "").toLowerCase();
  const Icon = ICONS[iconKey] ?? DEFAULT_ICON;

  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length === 0) {
    return <NavLeaf item={item} normalized={normalized} />;
  }

  return (
    <li>
      <button
        type="button"
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[0.88rem] leading-snug text-white/80",
          "border border-transparent transition-all duration-200",
          "hover:bg-white/10 hover:border-white/12 hover:text-white",
          open && "text-white/95",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon aria-hidden className="size-5 shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
        <span className="truncate flex-1 text-left">{item.label}</span>
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 opacity-60 transition-transform duration-250",
            open && "rotate-90",
          )}
        />
      </button>
      <Collapsible open={open}>
        <ul className="mt-0.5 space-y-0.5">
          {visibleChildren.map((c) =>
            c.children?.length ? (
              <NavGroup key={c.id} item={c} normalized={normalized} />
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
function NavItem({ item, normalized }: { item: BffNavItem; normalized: string }) {
  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length > 0) {
    return <NavGroup item={item} normalized={normalized} />;
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
  defaultOpen,
}: {
  label: string;
  items: BffNavItem[];
  normalized: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

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
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 opacity-60 transition-transform duration-250",
            open && "rotate-90",
          )}
        />
      </button>

      {/* Module body */}
      <Collapsible open={open}>
        <ul className="space-y-0.5 pb-1">
          {items.map((item) => (
            <NavItem key={item.id} item={item} normalized={normalized} />
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR NAV — main export
   ═══════════════════════════════════════════════════════════════════ */
export default function SidebarNavClient({ items }: { items: BffNavItem[] }) {
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
    const norm = normalized.toLowerCase();
    for (const mod of MODULE_ORDER) {
      for (const item of grouped[mod]) {
        if (hasActiveDescendant(item, normalized)) return mod;
      }
    }
    return "Recrutamento";
  }, [grouped, normalized]);

  return (
    <nav className="px-2 pb-4 pt-1">
      {MODULE_ORDER.map((mod) => (
        <ModuleSection
          key={mod}
          label={mod}
          items={grouped[mod]}
          normalized={normalized}
          defaultOpen={mod === activeModule}
        />
      ))}
    </nav>
  );
}
