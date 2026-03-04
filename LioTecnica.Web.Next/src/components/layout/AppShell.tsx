"use client";

import { useEffect, useState, type ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { BffNavItem } from "@/lib/schemas/bff";
import { ApiMenuForCurrentUserSchema, type ApiMenuForCurrentUser } from "@/lib/schemas/api";

/* Owner-only synthetic menu items (not stored in the DB) */
const OWNER_NAV_ITEMS: BffNavItem[] = [
  { id: "__owner_tenants", label: "Tenants", href: "/Owner/Tenants", icon: "building2", openInNewTab: false, children: [] },
  { id: "__owner_ia", label: "IA", href: "/Owner/IA", icon: "brain", openInNewTab: false, children: [] },
];

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

    // ── Fix orphan pesquisa items ─────────────────────────────────
    const pesquisaRoutes = new Set(["/feedback/pesquisarapida", "/feedback/superpesquisa"]);
    const orphanPesquisas = result.filter(
      (n) => pesquisaRoutes.has(n.href.toLowerCase().replace(/\/+$/, "")),
    );
    if (orphanPesquisas.length > 0) {
      const alreadyGrouped = result.some(
        (n) => n.children.some((c) => pesquisaRoutes.has(c.href.toLowerCase().replace(/\/+$/, ""))),
      );
      if (!alreadyGrouped) {
        const pesquisasGroup: BffNavItem = {
          id: "__pesquisas_group",
          label: "Pesquisas",
          href: "#",
          icon: "bi-search",
          openInNewTab: false,
          children: orphanPesquisas,
        };
        const firstIdx = result.findIndex((n) => orphanPesquisas.includes(n));
        const filtered = result.filter((n) => !orphanPesquisas.includes(n));
        filtered.splice(firstIdx, 0, pesquisasGroup);
        return filtered;
      }
    }

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

    (async () => {
      try {
        const res = await apiFetch("/api/menus/for-current-user", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const raw = Array.isArray(json) ? json : [];
        const parsed = raw
          .map((x) => ApiMenuForCurrentUserSchema.safeParse(x))
          .filter((r) => r.success)
          .map((r) => r.data);
        if (!cancelled) setNavItems(buildTree(parsed as any));
      } catch {
        // Navigation will render with empty items — non-blocking.
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

