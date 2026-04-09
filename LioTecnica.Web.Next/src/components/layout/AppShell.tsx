"use client";

import { useEffect, useState, type ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { buildTenantExtraNavItems, collectNavRouteKeys, NAV_MENU_CACHE_KEY, toNavRouteKey } from "@/features/navigation/recruitmentNavigation";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { BffMe, BffNavItem } from "@/lib/schemas/bff";
import { ApiMenuForCurrentUserSchema, type ApiMenuForCurrentUser } from "@/lib/schemas/api";

/* Owner-only synthetic menu items (not stored in the DB) */
const OWNER_NAV_ITEMS: BffNavItem[] = [
  { id: "__owner_tenants", label: "Tenants", href: "/Owner/Tenants", icon: "building2", openInNewTab: false, children: [] },
  { id: "__owner_ia", label: "IA", href: "/Owner/IA", icon: "brain", openInNewTab: false, children: [] },
  { id: "__owner_integracao", label: "Integração", href: "/Owner/Integracao", icon: "arrow-right-left", openInNewTab: false, children: [] },
];

/* Cadastros extras — injetados estaticamente para garantir que apareçam no menu
   mesmo antes do seeder do backend ter inserido os registros no banco. */
const STATIC_CADASTROS_EXTRAS: BffNavItem[] = [
  { id: "__cat_sal", label: "Categoria Salarial", href: "/Categorias-Salariais", icon: "bi-cash-coin", openInNewTab: false, children: [] },
  { id: "__turnos", label: "Turno", href: "/Turnos", icon: "bi-clock", openInNewTab: false, children: [] },
  { id: "__cc", label: "Centro de Custo", href: "/Centros-Custo", icon: "bi-receipt", openInNewTab: false, children: [] },
  { id: "__ul", label: "Unidade de Lotação", href: "/Unidades-Lotacao", icon: "bi-geo-alt", openInNewTab: false, children: [] },
];

function mergeTenantExtras(tree: BffNavItem[], me: BffMe): BffNavItem[] {
  const existingKeys = collectNavRouteKeys(tree);
  const extras = buildTenantExtraNavItems(me).filter((item) => !existingKeys.has(toNavRouteKey(item.href)));
  // Inject static cadastros if not already present from DB
  const staticExtras = STATIC_CADASTROS_EXTRAS.filter(
    (item) => !existingKeys.has(toNavRouteKey(item.href))
  );
  return [...tree, ...extras, ...staticExtras];
}

function AppShellInner({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [navItems, setNavItems] = useState<BffNavItem[]>([]);

  function buildTree(items: ApiMenuForCurrentUser[]): BffNavItem[] {
    const nodes = new Map<string, BffNavItem & { _order: number; _parentId: string | null }>();
    for (const m of items) {
      const id = (m.id ?? "").toString();
      if (!id) continue;
      nodes.set(id, {
        id,
        label: m.displayName ?? "",
        href: m.route ?? "#",
        icon: m.icon ?? null,
        openInNewTab: !!m.openInNewTab,
        children: [],
        _order: m.order ?? 0,
        _parentId: (m.parentId ?? null) as string | null,
      });
    }

    const roots: Array<BffNavItem & { _order: number; _parentId: string | null }> = [];
    for (const n of nodes.values()) {
      if (n._parentId && nodes.has(n._parentId)) {
        nodes.get(n._parentId)!.children.push(n);
      } else {
        roots.push(n);
      }
    }

    function sortRec(list: Array<BffNavItem & { _order: number }>) {
      list.sort((a, b) => a._order - b._order || a.label.localeCompare(b.label, "pt-BR"));
      list.forEach((x) => sortRec(x.children as any));
    }
    sortRec(roots as any);

    // Strip private fields
    const strip = (n: any): BffNavItem => ({
      id: n.id,
      label: n.label,
      href: n.href,
      icon: n.icon ?? null,
      openInNewTab: !!n.openInNewTab,
      children: Array.isArray(n.children) ? n.children.map(strip) : [],
    });
    const result = roots.map(strip);

    return result;
  }

  useEffect(() => {
    let cancelled = false;

    // Owner context: show only Owner items (Tenants + IA), no tenant menus
    if (me?.isOwnerContext) {
      setNavItems([...OWNER_NAV_ITEMS]);
      return;
    }

    // Regular tenant user: fetch menus from API
    if (!me) return;

    // ── Instant render from sessionStorage cache ──
    const CACHE_KEY = NAV_MENU_CACHE_KEY;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ApiMenuForCurrentUser[];
        if (Array.isArray(parsed) && parsed.length > 0 && !cancelled) {
          const tree = buildTree(parsed);
          setNavItems(mergeTenantExtras(tree, me));
        }
      }
    } catch { /* ignore corrupt cache */ }

    // ── Background refresh (stale-while-revalidate) ──
    (async () => {
      try {
        const res = await apiFetch("/api/menus/for-current-user", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const raw = Array.isArray(json) ? json : [];
        const parsed = raw
          .map((x: unknown) => ApiMenuForCurrentUserSchema.safeParse(x))
          .filter((r): r is { success: true; data: ApiMenuForCurrentUser } => r.success)
          .map((r) => r.data);
        if (!cancelled) {
          const tree = buildTree(parsed as any);
          setNavItems(mergeTenantExtras(tree, me));
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(parsed)); } catch { }
        }
      } catch {
        // Navigation will render with cached items — non-blocking.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me]);

  return (
    <div className="min-h-dvh">
      <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr]">
        <aside
          className="from-lt-primary to-lt-brand sticky top-0 hidden h-dvh border-r border-white/10 bg-gradient-to-b text-white lg:block z-10"
        >
          <Sidebar items={navItems} />
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--lt-border)] bg-[rgba(246,249,252,0.78)] backdrop-blur-[10px]">
            <Topbar navItems={navItems} />
          </header>
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShellInner>{children}</AppShellInner>
    </AuthProvider>
  );
}

