"use client";

import { useMemo, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Gauge,
  Globe,
  Heart,
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

/* ─── Icon map: Bootstrap Icon name → Lucide equivalent ─── */
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
  // Fallback plain names (for owner nav items set in C#)
  brain: Brain,
  building2: Building2,
  briefcase: Briefcase,
  layoutdashboard: LayoutDashboard,
};

/* ─── Module classification (mirrors Razor GetModuleKey) ─── */
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

const HIDDEN_ROUTES = new Set(["/matching"]); // acesso via Vagas

function getModuleKey(href: string, children?: BffNavItem[]): ModuleKey {
  if (!href || href === "#") {
    // Group parent with no route — classify by children's routes
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

  return "Recrutamento"; // default
}

function isRouteHidden(href: string): boolean {
  return HIDDEN_ROUTES.has(href.replace(/\/+$/, "").toLowerCase());
}

/* ─── NavLink ─── */
function NavLink({ item, normalized }: { item: BffNavItem; normalized: string }) {
  const rawHref = item.href || "#";
  // Use original href case from BFF — Next.js route folders match the BFF casing
  const href = rawHref;
  const normalizedLower = normalized.toLowerCase();
  const hrefLower = href.toLowerCase().replace(/\/+$/, "");
  const active =
    hrefLower !== "#" &&
    (normalizedLower === hrefLower || (hrefLower.length > 1 && normalizedLower.startsWith(`${hrefLower}/`)));
  const iconKey = (item.icon ?? "").toLowerCase();
  const Icon = ICONS[iconKey] ?? DEFAULT_ICON;
  const target = item.openInNewTab ? "_blank" : undefined;
  const rel = item.openInNewTab ? "noopener noreferrer" : undefined;

  return (
    <li>
      <Link
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9rem] leading-snug text-white/85 transition",
          "hover:bg-white/10 hover:text-white",
          active && "bg-white/15 font-medium text-white",
        )}
        href={href}
        rel={rel}
        target={target}
      >
        <Icon aria-hidden className="size-5 shrink-0 opacity-90" />
        <span className="truncate">{item.label}</span>
      </Link>

      {item.children?.length ? (
        <ul className="mt-1 space-y-1 pl-4">
          {item.children
            .filter((c) => !isRouteHidden(c.href))
            .map((c) => (
              <NavLink item={c} key={c.id} normalized={normalized} />
            ))}
        </ul>
      ) : null}
    </li>
  );
}

/* ─── Module Section ─── */
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
    <div className="mb-2">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-[0.7rem] font-bold tracking-[0.15em] text-white/90 uppercase hover:text-white transition"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        {open ? (
          <ChevronDown className="size-3.5 opacity-70" />
        ) : (
          <ChevronRight className="size-3.5 opacity-70" />
        )}
      </button>

      {open && (
        <ul className="space-y-1">
          {items.map((item) => (
            <NavLink item={item} key={item.id} normalized={normalized} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Sidebar Nav ─── */
export default function SidebarNavClient({ items }: { items: BffNavItem[] }) {
  const pathname = usePathname();
  const normalized = pathname.replace(/^\/app(?=\/|$)/, "") || "/";

  const grouped = useMemo(() => {
    const map: Record<ModuleKey, BffNavItem[]> = {
      Recrutamento: [],
      Cadastros: [],
      Relatórios: [],
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

  // Determine which module contains the active route
  const activeModule = useMemo<ModuleKey>(() => {
    const norm = normalized.toLowerCase();
    for (const mod of MODULE_ORDER) {
      for (const item of grouped[mod]) {
        const href = (item.href || "").replace(/\/+$/, "").toLowerCase();
        if (href !== "#" && (norm === href || (href.length > 1 && norm.startsWith(`${href}/`)))) {
          return mod;
        }
        // Check children
        for (const child of item.children ?? []) {
          const childHref = (child.href || "").replace(/\/+$/, "").toLowerCase();
          if (childHref !== "#" && (norm === childHref || (childHref.length > 1 && norm.startsWith(`${childHref}/`)))) {
            return mod;
          }
        }
      }
    }
    return "Recrutamento";
  }, [grouped, normalized]);

  return (
    <nav className="px-2 pb-4 pt-2">
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
