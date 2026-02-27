"use client";

import { useEffect, useState, type ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { AuthProvider } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { BffNavItem } from "@/lib/schemas/bff";
import { ApiMenuForCurrentUserSchema, type ApiMenuForCurrentUser } from "@/lib/schemas/api";

export default function AppShell({ children }: { children: ReactNode }) {
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
    return roots.map(strip);
  }

  useEffect(() => {
    let cancelled = false;

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
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-dvh">
        <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr]">
          <aside className="from-lt-primary to-lt-brand sticky top-0 hidden h-dvh border-r border-white/10 bg-gradient-to-b text-white lg:block">
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
    </AuthProvider>
  );
}
