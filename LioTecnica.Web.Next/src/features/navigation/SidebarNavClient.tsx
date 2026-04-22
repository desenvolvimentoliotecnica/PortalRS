"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
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
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { BffNavItem } from "@/lib/schemas/bff";
import { prefetchScreenData } from "@/lib/screenCache";
import {
  PRINCIPAIS_ORDER,
  RECRUITMENT_LINEAR_ORDER,
  RECRUITMENT_MVP_ORDER,
  RECRUITMENT_ROUTE_KEYS,
  RECRUITMENT_ROUTE_LABELS,
  toNavRouteKey,
} from "@/features/navigation/recruitmentNavigation";
import { getVisibleMenuHrefs, isHrefAllowed } from "@/features/navigation/menuPermissions";
import { useAuth } from "@/hooks/useAuth";
import { usePendencias } from "@/contexts/PendenciasContext";

/* ═══════════════════════════════════════════════════════════════════
   ICON MAP: Bootstrap Icon name → Lucide equivalent
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULT_ICON: LucideIcon = BarChart3;

/* Rotas que aparecem como bloqueadas no menu (ícone de cadeado, sem link) */
const LOCKED_NAV_PREFIXES: string[] = ["/feedback", "/desempenho"];

const LOCKED_NAV_HREFS = new Set([
  // Já existentes
  "/areas",
  "/funcoes",
  "/cadastro/funcoes",
  // Gestão de Pessoas (todos os filhos)
  "/gestao/dashboard",
  "/gestao/planosdesenvolvimento",
  "/gestao/humor",
  "/gestao/resumoatividades",
  // Operacional — itens não utilizados
  "/agendas",
  "/gestao/batida-ponto",
  // Feedback — leaf sem prefixo /feedback
  "/pesquisas",
  // Recrutamento — itens ainda não liberados
  "/matching",
  "/triagem",
  "/gestao/processo-seletivo",
  // Admin — em breve
  "/admin/accesses",
]);

function isNavLocked(href: string): boolean {
  if (LOCKED_NAV_HREFS.has(href)) return true;
  return LOCKED_NAV_PREFIXES.some((p) => href === p || href.startsWith(p + "/"));
}
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
  // Cadastros TOTVS
  "bi-layers": Layers,
  "bi-cash-coin": Coins,
  "bi-clock": Timer,
  "bi-receipt": Receipt,
  "bi-geo-alt": MapPin,
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
  "cloud-upload": CloudUpload,
  // Fallback plain names
  activity: Activity,
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
  fileup: FileUp,
  gitbranch: GitBranch,
  globe: Globe,
  grid: Grid2X2,
  landmark: Landmark,
  layers: Layers,
  layoutdashboard: LayoutDashboard,
  listchecks: ListChecks,
  "map-pin": MapPin,
  "message-square": MessageSquare,
  "party-popper": PartyPopper,
  "pie-chart": PieChart,
  send: Send,
  settings2: Settings2,
  shield: Shield,
  smile: Smile,
  sparkles: Sparkles,
  tags: Tags,
  target: Target,
  "trending-up": TrendingUp,
  user: User,
  "user-check": UserCheck,
  usercheck: UserCheck,
  "user-minus": UserMinus,
  users: Users,
  "user-x": UserX,
  // Colaborador
  "credit-card": CreditCard,
  "file-text":   FileText,
  "palmtree":    Palmtree,
  "receipt":     Receipt,
  "lock":        LockKeyhole,
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
  "/feedback/metas": "/feedback/metas",
  "/feedback/avaliacoes": "/feedback/avaliacoes",
  "/feedback/minhas-avaliacoes": "/feedback/minhas-avaliacoes",
  "/feedback/desempenho/minhasavaliacoes": "/feedback/minhas-avaliacoes",
  "/feedback/nine-box": "/feedback/gestao",
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
  "/colaborador/ferias": "/colaborador/ferias",
  "/colaborador/beneficios": "/colaborador/beneficios",
  "/colaborador/solicitacao-dependentes": "/colaborador/solicitacao-dependentes",
  "/colaborador/endereco": "/colaborador/endereco",
  // Gestão de Pessoas
  "/gestao/desligamentos": "/gestao/desligamentos",
  "/gestao/promocoes": "/gestao/promocoes",
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
  "/admin/awssettings": "/Owner/AwsSettings",
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
type ModuleKey = "Principais" | "Minha Área" | "Recrutamento" | "Cadastros Pessoas" | "Cadastros Operacionais" | "Relatórios" | "Gestão de Pessoas" | "Operacional" | "Feedback" | "Admin" | "Owner";
const MODULE_ORDER: ModuleKey[] = ["Principais", "Minha Área", "Recrutamento", "Operacional", "Gestão de Pessoas", "Cadastros Pessoas", "Cadastros Operacionais", "Relatórios", "Feedback", "Admin", "Owner"];

// Itens de 1º nível (sem header de módulo) — vêm antes de Recrutamento
const PRINCIPAIS_ROUTES = new Set<string>(PRINCIPAIS_ORDER as unknown as string[]);

// Fluxo linear de recrutamento — MVP + secundários (sem TOTVS, que vai pro header dropdown)
const RECRUTAMENTO_ROUTES = new Set<string>([
  RECRUITMENT_ROUTE_KEYS.vagas,
  RECRUITMENT_ROUTE_KEYS.painelRh,
  RECRUITMENT_ROUTE_KEYS.candidatos,
  RECRUITMENT_ROUTE_KEYS.admissao,
  RECRUITMENT_ROUTE_KEYS.matching,
  RECRUITMENT_ROUTE_KEYS.triagem,
  RECRUITMENT_ROUTE_KEYS.processoSeletivo,
]);
// Operacional (dia a dia)
const OPERACIONAL_ROUTES = new Set([
  "/agendas", "/entradaemailpasta",
  "/gestao/batida-ponto", "/gestao/comissoes",
  "/gestao/desligamentos",
]);
const CADASTROS_PESSOAS_ROUTES = new Set([
  "/pessoas", "/funcionarios", "/bloqueiopessoa",
]);
const CADASTROS_OPERACIONAIS_ROUTES = new Set([
  "/departamentos", "/areas", "/categorias", "/cargos",
  "/unidades", "/categorias-salariais", "/turnos",
  "/centros-custo", "/unidades-lotacao", "/empresas",
  "/nivel-cargo",
]);
// Gestão de Pessoas (people management, não recrutamento)
const GESTAO_PESSOAS_ROUTES = new Set([
  "/gestao/dashboard", "/gestao/planosdesenvolvimento",
  "/gestao/humor", "/gestao/resumoatividades",
]);
const COLABORADOR_ROUTES = new Set([
  "/colaborador/perfil",
  "/colaborador/dependentes",
  "/colaborador/endereco",
  "/colaborador/dados-bancarios",
  "/colaborador/ferias",
  "/colaborador/beneficios",
  "/colaborador/holerites",
  "/colaborador/documentos",
  "/colaborador/historico-carreira",
  "/colaborador/senha",
  "/colaborador/solicitacao-dependentes",
]);

const HIDDEN_ROUTES = new Set([
  "/departamentos", "/gestao/pipeline",
  "/portalvagas",
  "/talentos",
  "/gestao/projetos",
  "/admissao/integracao",
  // Pesquisas antigas removidas — unificadas em /feedback/pesquisas
  "/feedback/pesquisarapida",
  "/feedback/superpesquisa",
  // AWS Settings movido para Owner — não deve aparecer no menu de tenant
  "/admin/awssettings",
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
  if (r.startsWith("/colaborador/") || COLABORADOR_ROUTES.has(r)) return "Minha Área";
  if (PRINCIPAIS_ROUTES.has(r)) return "Principais";
  if (r.startsWith("/owner")) return "Owner";
  if (r.startsWith("/admin")) return "Admin";
  if (r === "/relatorios") return "Relatórios";
  if (r === "/pesquisas") return "Feedback";
  if (r.startsWith("/feedback") || r.startsWith("/desempenho")) return "Feedback";
  if (RECRUTAMENTO_ROUTES.has(r)) return "Recrutamento";
  if (OPERACIONAL_ROUTES.has(r)) return "Operacional";
  if (GESTAO_PESSOAS_ROUTES.has(r)) return "Gestão de Pessoas";
  if (CADASTROS_PESSOAS_ROUTES.has(r)) return "Cadastros Pessoas";
  if (CADASTROS_OPERACIONAIS_ROUTES.has(r) || r.startsWith("/cadastro/")) return "Cadastros Operacionais";
  // Fallback: any /gestao/* not matched goes to Recrutamento (new screens)
  if (r.startsWith("/gestao")) return "Recrutamento";
  return "Recrutamento";
}

function isRouteHidden(href: string): boolean {
  return HIDDEN_ROUTES.has(href.replace(/\/+$/, "").toLowerCase());
}

/** Check if a normalized pathname matches a given href.
 *  Exact match first; then prefix match only for known sub-routes (e.g. /vagas/editar → /vagas). */
function isActive(normalized: string, href: string): boolean {
  const n = normalized.toLowerCase().replace(/\/+$/, "") || "/";
  const h = href.toLowerCase().replace(/\/+$/, "");
  if (h === "#" || h === "") return false;
  if (n === h) return true;
  // Prefix match apenas para rotas com segmento adicional (não raiz)
  if (h !== "/" && h !== "" && n.startsWith(h + "/")) return true;
  return false;
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

  // Lista linear seguindo a ordem do fluxo — MVP primeiro, depois secundários com divisor
  const result: BffNavItem[] = [];
  const used = new Set<string>();
  const mvpSet = new Set<string>(RECRUITMENT_MVP_ORDER as unknown as string[]);

  for (const routeKey of RECRUITMENT_LINEAR_ORDER) {
    const item = known.get(routeKey);
    if (!item) continue;
    // Inserir divisor visual antes do primeiro item secundário
    if (!mvpSet.has(routeKey) && result.length > 0 && !result.some(r => r.id === "__divider__")) {
      result.push({ id: "__divider__", label: "", href: "#", icon: "", openInNewTab: false, children: [] });
    }
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
  isCollapsed = false,
}: {
  item: BffNavItem;
  normalized: string;
  indent?: boolean;
  isCollapsed?: boolean;
}) {
  const href = normalizeHref(item.href || "#");
  const active = isActive(normalized, href);
  const iconKey = (item.icon ?? "").toLowerCase();
  const Icon = ICONS[iconKey] ?? DEFAULT_ICON;
  const target = item.openInNewTab ? "_blank" : undefined;
  const rel = item.openInNewTab ? "noopener noreferrer" : undefined;

  // Pendências badge
  const isPendencias = href === "/gestao/aprovacoes";
  const { count: pendenciasCount } = usePendencias();
  const showBadge = isPendencias && pendenciasCount > 0;

  if (isNavLocked(href)) {
    return (
      <li>
        <span
          title="Em breve"
          className={cn(
            "group flex items-center gap-3 px-3 py-2 rounded-xl text-[0.88rem] leading-snug",
            "text-white/35 cursor-not-allowed select-none",
            indent && !isCollapsed && "ml-5 text-[0.82rem] py-1.5",
            isCollapsed && "justify-center px-2",
          )}
        >
          <LockKeyhole
            aria-hidden
            className={cn("shrink-0 opacity-40", indent && !isCollapsed ? "size-[18px]" : "size-5")}
          />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </span>
      </li>
    );
  }

  return (
    <li className={showBadge && isCollapsed ? "relative" : undefined}>
      <Link
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-xl text-[0.88rem] leading-snug text-white/80",
          "border border-transparent transition-all duration-200",
          "hover:bg-white/10 hover:border-white/12 hover:text-white",
          active && "bg-white/[.16] border-white/[.22] text-white font-medium",
          indent && !isCollapsed && "ml-5 text-[0.82rem] py-1.5",
          isCollapsed && "justify-center px-2",
        )}
        href={href}
        rel={rel}
        target={target}
        title={isCollapsed ? `${item.label}${showBadge ? ` (${pendenciasCount})` : ""}` : undefined}
        onMouseEnter={() => void prefetchScreenData(href)}
      >
        <Icon
          aria-hidden
          className={cn(
            "shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100",
            indent && !isCollapsed ? "size-[18px]" : "size-5",
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

/* ═══════════════════════════════════════════════════════════════════
   NAV GROUP — item with children (sub-accordion)
   ═══════════════════════════════════════════════════════════════════ */
function NavGroup({
  item,
  normalized,
  openGroups,
  onGroupOpenChange,
  isCollapsed = false,
}: {
  item: BffNavItem;
  normalized: string;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
  isCollapsed?: boolean;
}) {
  const href = normalizeHref(item.href || "#");
  const iconKey = (item.icon ?? "").toLowerCase();
  const Icon = ICONS[iconKey] ?? DEFAULT_ICON;
  const target = item.openInNewTab ? "_blank" : undefined;
  const rel = item.openInNewTab ? "noopener noreferrer" : undefined;

  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length === 0) {
    return <NavLeaf item={item} normalized={normalized} isCollapsed={isCollapsed} />;
  }

  const hasActive = hasActiveDescendant(item, normalized);
  const canNavigate = href !== "#";
  const isOpen = isCollapsed ? true : (openGroups?.[item.id] ?? hasActive);

  const handleToggle = () => {
    onGroupOpenChange?.(item.id, !isOpen);
  };

  // In collapsed mode: render icon-only, no label, no chevron
  if (isCollapsed) {
    const collapsedClass = cn(
      "group flex w-full items-center justify-center rounded-xl px-2 py-2 text-[0.88rem] leading-snug text-white/80",
      "border border-transparent transition-all duration-200",
      "hover:bg-white/10 hover:border-white/12 hover:text-white",
      hasActive && "bg-white/[.08] border-white/[.14] text-white/95",
    );
    return (
      <li>
        {canNavigate ? (
          <Link
            className={collapsedClass}
            href={href}
            rel={rel}
            target={target}
            title={item.label}
            onMouseEnter={() => void prefetchScreenData(href)}
          >
            <Icon aria-hidden className="size-5 shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
          </Link>
        ) : (
          <button type="button" className={collapsedClass} title={item.label} onClick={handleToggle}>
            <Icon aria-hidden className="size-5 shrink-0 opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
          </button>
        )}
      </li>
    );
  }

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
              <NavGroup key={c.id} item={c} normalized={normalized} openGroups={openGroups} onGroupOpenChange={onGroupOpenChange} isCollapsed={isCollapsed} />
            ) : (
              <NavLeaf key={c.id} item={c} normalized={normalized} indent isCollapsed={isCollapsed} />
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
  isCollapsed = false,
}: {
  item: BffNavItem;
  normalized: string;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
  isCollapsed?: boolean;
}) {
  if (item.id === "__divider__") {
    return isCollapsed ? null : <li className="my-2 border-t border-white/10" />;
  }
  const visibleChildren = (item.children ?? []).filter((c) => !isRouteHidden(c.href));
  if (visibleChildren.length > 0) {
    return (
      <NavGroup
        item={item}
        normalized={normalized}
        openGroups={openGroups}
        onGroupOpenChange={onGroupOpenChange}
        isCollapsed={isCollapsed}
      />
    );
  }
  return <NavLeaf item={item} normalized={normalized} isCollapsed={isCollapsed} />;
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
  isCollapsed = false,
  hideLabel = false,
}: {
  label: string;
  items: BffNavItem[];
  normalized: string;
  moduleOpen: boolean;
  onModuleOpenChange: (open: boolean) => void;
  openGroups?: Record<string, boolean>;
  onGroupOpenChange?: (id: string, open: boolean) => void;
  isCollapsed?: boolean;
  hideLabel?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-1">
      {/* Module header — hidden when collapsed or when hideLabel (itens de 1º nível) */}
      {!isCollapsed && !hideLabel && (
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
      )}

      {/* Module body — always open when collapsed or when header is hidden */}
      <Collapsible open={isCollapsed || hideLabel ? true : moduleOpen}>
        <ul className="space-y-0.5 pb-1">
          {items.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              normalized={normalized}
              openGroups={openGroups}
              onGroupOpenChange={onGroupOpenChange}
              isCollapsed={isCollapsed}
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
export default function SidebarNavClient({ items, isCollapsed = false }: { items: BffNavItem[]; isCollapsed?: boolean }) {
  const pathname = usePathname();
  const normalized = pathname.replace(/^\/app(?=\/|$)/, "") || "/";
  const { me } = useAuth();

  // Filtro de permissão por perfil — Gestor/Compliance veem apenas rotas da allowlist.
  const allowedHrefs = useMemo(() => (me ? getVisibleMenuHrefs(me) : null), [me]);

  // Colaborador puro: não tem acesso irrestrito nem "access.manage"
  const isPureColaborador = useMemo(() =>
    !!me &&
    !me.permissions.includes("*") &&
    !me.permissions.includes("access.manage") &&
    me.permissions.some((p) => p.startsWith("colaborador.")),
    [me],
  );
  const filteredItems = useMemo(() => {
    if (!allowedHrefs) return items;
    const filterTree = (list: BffNavItem[]): BffNavItem[] =>
      list
        .map((it) => {
          const children = filterTree(it.children ?? []);
          const selfAllowed = isHrefAllowed(it.href, allowedHrefs);
          if (selfAllowed || children.length > 0) return { ...it, children };
          return null;
        })
        .filter((x): x is BffNavItem => x !== null);
    return filterTree(items);
  }, [items, allowedHrefs]);

  // ── 1. Group items by module (only recomputes when items change) ──
  const grouped = useMemo(() => {
    const map: Record<ModuleKey, BffNavItem[]> = {
      Principais: [],
      "Minha Área": [],
      Recrutamento: [],
      "Operacional": [],
      "Gestão de Pessoas": [],
      "Cadastros Pessoas": [],
      "Cadastros Operacionais": [],
      "Relatórios": [],
      Feedback: [],
      Admin: [],
      Owner: [],
    };

    // Collect top-level hrefs so we can strip duplicate children.
    // If a route appears both as a top-level item AND as a child of a group
    // (e.g. "Categoria Salarial" inside "Unidade"), keep only the top-level entry.
    const topLevelHrefs = new Set(
      filteredItems.map((i) => (i.href || "").replace(/\/+$/, "").toLowerCase()),
    );

    for (const item of filteredItems) {
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
        // Strip children that also exist as top-level items to avoid duplicates.
        const deduped =
          item.children.length > 0
            ? {
                ...item,
                children: item.children.filter(
                  (c) => !topLevelHrefs.has((c.href || "").replace(/\/+$/, "").toLowerCase()),
                ),
              }
            : item;
        // Override label for specific routes whose display name comes from the DB
        const hrefLower = (deduped.href || "").replace(/\/+$/, "").toLowerCase();
        const labeled = hrefLower === "/unidades"
          ? { ...deduped, label: "Estabelecimentos" }
          : deduped;
        map[key].push(labeled);
      }
    }
    // Sort both Cadastros sections alphabetically by label regardless of DB order
    map["Cadastros Pessoas"] = [...map["Cadastros Pessoas"]].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
    );
    map["Cadastros Operacionais"] = [...map["Cadastros Operacionais"]].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
    );
    map.Recrutamento = buildRecruitmentSidebar(map.Recrutamento);

    // Ordem fixa em "Principais": Dashboard → Minhas Pendências → Solicitações
    const principaisByRoute = new Map<string, BffNavItem>();
    for (const item of map.Principais) {
      const routeKey = toNavRouteKey(item.href);
      if (!principaisByRoute.has(routeKey)) {
        principaisByRoute.set(routeKey, cloneNavItem(item, {
          href: normalizeHref(item.href || "#"),
          label: RECRUITMENT_ROUTE_LABELS[routeKey] ?? item.label,
          children: [],
        }));
      }
    }
    const principaisOrdered: BffNavItem[] = [];
    for (const routeKey of PRINCIPAIS_ORDER) {
      const it = principaisByRoute.get(routeKey);
      if (it) principaisOrdered.push(it);
    }
    map.Principais = principaisOrdered;

    return map;
  }, [filteredItems]);

  // "Minha Área" só aparece no sidebar para colaboradores puros.
  // Admin/RH/Gestor acessam via dashboard.
  const visibleGrouped = useMemo<Record<ModuleKey, BffNavItem[]>>(() => {
    if (isPureColaborador) return grouped;
    return { ...grouped, "Minha Área": [] };
  }, [grouped, isPureColaborador]);

  const renderedItems = useMemo(
    () => MODULE_ORDER.flatMap((mod) => visibleGrouped[mod]),
    [visibleGrouped],
  );

  // ── 2. Detect which module owns the current route ──
  const activeModule = useMemo<ModuleKey>(() => {
    for (const mod of MODULE_ORDER) {
      for (const item of visibleGrouped[mod]) {
        if (hasActiveDescendant(item, normalized)) return mod;
      }
    }
    return MODULE_ORDER.find((m) => visibleGrouped[m].length > 0) ?? "Recrutamento";
  }, [visibleGrouped, normalized]);

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
          items={visibleGrouped[mod]}
          normalized={normalized}
          moduleOpen={resolvedModuleOpen[mod]}
          onModuleOpenChange={handleModuleOpenChange(mod)}
          openGroups={resolvedOpenGroups}
          onGroupOpenChange={handleGroupOpenChange}
          isCollapsed={isCollapsed}
          hideLabel={mod === "Principais"}
        />
      ))}
    </nav>
  );
}

