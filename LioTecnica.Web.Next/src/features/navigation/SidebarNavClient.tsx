"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRightLeft,
  Award,
  BadgeDollarSign,
  BarChart3,
  BookCheck,
  BookOpen,
  Brain,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CheckCheck,
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CloudUpload,
  Coins,
  CreditCard,
  Database,
  FileText,
  FileUp,
  Filter,
  Gauge,
  GitBranch,
  Globe,
  Grid2X2,
  Heart,
  Home,
  Inbox,
  Key,
  KeyRound,
  Landmark,
  Languages,
  Layers,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  NotebookPen,
  Palette,
  Palmtree,
  PartyPopper,
  PieChart,
  Receipt,
  Search,
  SearchCheck,
  Send,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  Smile,
  Sparkles,
  Tags,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { prefetchScreenData } from "@/lib/screenCache";
import { usePendencias } from "@/contexts/PendenciasContext";
import type {
  NavGrupoResponse,
  NavItemResponse,
} from "@/lib/schemas/navegacao";

/* ═══════════════════════════════════════════════════════════════════
   ICON MAP: Bootstrap/alias name → Lucide equivalent.
   O backend (NavegacaoManifest) escolhe o nome do ícone; este map
   apenas converte para o componente React que renderiza.
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULT_ICON: LucideIcon = BarChart3;

const ICONS: Record<string, LucideIcon> = {
  // Bootstrap-style aliases (legado — mantidos para retro-compat)
  "bi-speedometer2": Gauge,
  "bi-calendar-event": Calendar,
  "bi-briefcase": Briefcase,
  "bi-people": Users,
  "bi-person-plus": UserPlus,
  "bi-funnel": Filter,
  "bi-stars": Sparkles,
  "bi-inbox": Inbox,
  "bi-globe": Globe,
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
  "bi-layers": Layers,
  "bi-cash-coin": Coins,
  "bi-clock": Timer,
  "bi-receipt": Receipt,
  "bi-geo-alt": MapPin,
  "bi-graph-up": TrendingUp,
  "bi-diagram-2": Network,
  "bi-diagram-3": Network,
  "bi-tags": Tags,
  "bi-building": Building,
  "bi-person-x": UserX,
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
  "cloud-upload": CloudUpload,
  // Plain names (preferido — o manifesto do backend usa estes)
  activity: Activity,
  "arrow-right-left": ArrowRightLeft,
  award: Award,
  "badge-dollar-sign": BadgeDollarSign,
  brain: Brain,
  briefcase: Briefcase,
  building: Building,
  building2: Building2,
  calendar: Calendar,
  checkcheck: CheckCheck,
  clipboardcheck: ClipboardCheck,
  clipboardlist: ClipboardList,
  clock: Clock,
  database: Database,
  "file-text": FileText,
  fileup: FileUp,
  filter: Filter,
  gitbranch: GitBranch,
  globe: Globe,
  grid: Grid2X2,
  heart: Heart,
  inbox: Inbox,
  landmark: Landmark,
  layers: Layers,
  layoutdashboard: LayoutDashboard,
  listchecks: ListChecks,
  palette: Palette,
  "map-pin": MapPin,
  "message-square": MessageSquare,
  "party-popper": PartyPopper,
  "pie-chart": PieChart,
  search: Search,
  "search-check": SearchCheck,
  send: Send,
  settings: Settings,
  settings2: Settings2,
  shield: Shield,
  "shield-check": ShieldCheck,
  smile: Smile,
  sparkles: Sparkles,
  tags: Tags,
  target: Target,
  timer: Timer,
  "trending-up": TrendingUp,
  trophy: Trophy,
  user: User,
  "user-check": UserCheck,
  usercheck: UserCheck,
  "user-minus": UserMinus,
  "user-plus": UserPlus,
  users: Users,
  "user-x": UserX,
  workflow: Workflow,
  // Colaborador
  "credit-card": CreditCard,
  "palmtree":    Palmtree,
  "receipt":     Receipt,
  "lock":        LockKeyhole,
};

function resolveIconName(name: string | null | undefined): string {
  if (!name) return "__default__";
  const lower = name.toLowerCase();
  return lower in ICONS ? lower : "__default__";
}

// Objeto resolvido em render: usa o mapa estático, não cria componente novo.
const ICONS_WITH_DEFAULT: Record<string, LucideIcon> = {
  ...ICONS,
  __default__: DEFAULT_ICON,
};

/* ═══════════════════════════════════════════════════════════════════
   ACTIVE ROUTE DETECTION
   ═══════════════════════════════════════════════════════════════════ */
function isActive(normalized: string, href: string): boolean {
  const n = normalized.toLowerCase().replace(/\/+$/, "") || "/";
  const h = href.toLowerCase().replace(/\/+$/, "");
  if (h === "#" || h === "") return false;
  if (n === h) return true;
  if (h !== "/" && n.startsWith(h + "/")) return true;
  return false;
}

/* ═══════════════════════════════════════════════════════════════════
   COLLAPSIBLE — CSS grid-template-rows animation (sem deps externas)
   ═══════════════════════════════════════════════════════════════════ */
function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
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
   NAV LEAF — renderiza um item (link ou cadeado, se motivoBloqueio).
   ═══════════════════════════════════════════════════════════════════ */
function NavLeaf({
  item,
  normalized,
  isCollapsed = false,
}: {
  item: NavItemResponse;
  normalized: string;
  isCollapsed?: boolean;
}) {
  const Icon = ICONS_WITH_DEFAULT[resolveIconName(item.icon)];
  const locked = !item.acessivel || !!item.motivoBloqueio;
  const active = !locked && isActive(normalized, item.href);

  const isPendencias = item.href === "/gestao/aprovacoes";
  const { count: pendenciasCount } = usePendencias();
  const showBadge = isPendencias && pendenciasCount > 0 && !locked;

  if (locked) {
    const tooltip = tooltipForMotivo(item.motivoBloqueio);
    return (
      <li>
        <span
          title={tooltip}
          className={cn(
            "group flex items-center gap-3 px-3 py-2 rounded-xl text-[0.88rem] leading-snug",
            "text-white/35 cursor-not-allowed select-none",
            isCollapsed && "justify-center px-2",
          )}
        >
          <LockKeyhole
            aria-hidden
            className={cn("shrink-0 opacity-40", "size-5")}
          />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </span>
      </li>
    );
  }

  const openInNewTab = item.openInNewTab === true;
  const isHttp = /^https?:\/\//i.test(item.href);

  return (
    <li className={showBadge && isCollapsed ? "relative" : undefined}>
      <Link
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-xl text-[0.88rem] leading-snug text-white/80",
          "border border-transparent transition-all duration-200",
          "hover:bg-white/10 hover:border-white/12 hover:text-white",
          active && "bg-white/[.16] border-white/[.22] text-white font-medium",
          isCollapsed && "justify-center px-2",
        )}
        href={item.href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        prefetch={isHttp ? false : undefined}
        title={
          isCollapsed
            ? `${item.label}${showBadge ? ` (${pendenciasCount})` : ""}`
            : undefined
        }
        onMouseEnter={() => {
          if (!isHttp) void prefetchScreenData(item.href);
        }}
      >
        <Icon
          aria-hidden
          className={cn(
            "shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100",
            "size-5",
            active && "opacity-100",
          )}
        />
        {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
        {!isCollapsed && showBadge && (
          <span className="pointer-events-none ml-auto flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {pendenciasCount > 99 ? "99+" : pendenciasCount}
          </span>
        )}
      </Link>
      {showBadge && isCollapsed && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white/20"
        />
      )}
    </li>
  );
}

function tooltipForMotivo(motivo: string | null | undefined): string {
  switch (motivo) {
    case "pacote-inativo":
      return "Pacote em desenvolvimento — em breve";
    case "pacote-nao-contratado":
      return "Pacote não contratado";
    case "modulo-desativado":
      return "Módulo desativado para este tenant";
    case "sem-permissao":
      return "Sem permissão";
    default:
      return "Em breve";
  }
}

/* ═══════════════════════════════════════════════════════════════════
   GROUP SECTION — bucket (principais, recrutamento-selecao, ...).
   O header é ocultado quando `ocultarHeader=true` (ex: grupo "principais").
   ═══════════════════════════════════════════════════════════════════ */
function GrupoSection({
  grupo,
  normalized,
  isOpen,
  onOpenChange,
  isCollapsed,
}: {
  grupo: NavGrupoResponse;
  normalized: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isCollapsed: boolean;
}) {
  if (grupo.itens.length === 0) return null;

  const hideLabel = grupo.ocultarHeader;
  const bodyAlwaysOpen = isCollapsed || hideLabel;

  return (
    <div className="mt-1">
      {!isCollapsed && !hideLabel && (
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2",
            "text-[0.72rem] font-bold tracking-[0.16em] text-white/85 uppercase",
            "transition-colors duration-200 hover:bg-white/[.08] hover:text-white",
          )}
          onClick={() => onOpenChange(!isOpen)}
        >
          <span>{grupo.label}</span>
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 opacity-60 transition-transform duration-250",
              isOpen && "rotate-90",
            )}
          />
        </button>
      )}

      <Collapsible open={bodyAlwaysOpen ? true : isOpen}>
        <ul className="space-y-0.5 pb-1">
          {grupo.itens.map((item) => (
            <NavLeaf
              key={item.id}
              item={item}
              normalized={normalized}
              isCollapsed={isCollapsed}
            />
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR NAV — main export.
   Consome os grupos já resolvidos pelo backend. Zero lógica de
   agrupamento/filtragem/locking aqui.
   ═══════════════════════════════════════════════════════════════════ */
export default function SidebarNavClient({
  grupos,
  isCollapsed = false,
}: {
  grupos: NavGrupoResponse[];
  isCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const normalized = pathname.replace(/^\/app(?=\/|$)/, "") || "/";

  // Overrides do usuário (abriu/fechou manualmente uma seção).
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const resolvedOpen = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const g of grupos) {
      out[g.key] = g.key in overrides ? overrides[g.key] : true;
    }
    return out;
  }, [grupos, overrides]);

  const handleOpenChange = useCallback(
    (key: string) => (open: boolean) => {
      setOverrides((prev) => ({ ...prev, [key]: open }));
    },
    [],
  );

  return (
    <nav className="pb-4 pt-1 px-2">
      {grupos.map((g) => (
        <GrupoSection
          key={g.key}
          grupo={g}
          normalized={normalized}
          isOpen={resolvedOpen[g.key] ?? false}
          onOpenChange={handleOpenChange(g.key)}
          isCollapsed={isCollapsed}
        />
      ))}
    </nav>
  );
}
