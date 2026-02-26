"use client";

import { useEffect, useState, type ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { AuthProvider } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { BffNavItem } from "@/server/bff/navigation.schema";

export default function AppShell({ children }: { children: ReactNode }) {
  const [navItems, setNavItems] = useState<BffNavItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch("/app/bff/navigation");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setNavItems(json.items ?? []);
        }
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
