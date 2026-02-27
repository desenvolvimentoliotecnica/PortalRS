"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import TopbarClient from "@/components/layout/TopbarClient";
import { getBackendUrl } from "@/lib/getBackendUrl";
import type { BffNavItem } from "@/server/bff/navigation.schema";
import type { BffMe } from "@/server/bff/schema";

export default function AppShellClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [navItems, setNavItems] = useState<BffNavItem[]>([]);
  const [me, setMe] = useState<BffMe | null>(null);
  const [ready, setReady] = useState(false);

  const base = getBackendUrl();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${base}/bff/navigation`, { credentials: "include", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (cancelled ? null : j?.items ?? [])),
      fetch(`${base}/bff/me`, { credentials: "include", cache: "no-store" })
        .then((r) => {
          if (r.status === 401 || (r.status >= 300 && r.status < 400)) return null;
          return r.ok ? r.json() : null;
        }),
    ]).then(([items, meData]) => {
      if (cancelled) return;
      if (!meData?.isAuthenticated) {
        const returnUrl = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname) : "";
        router.replace(`/login?returnUrl=${returnUrl}`);
        return;
      }
      setNavItems(items ?? []);
      setMe(meData);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [base, router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--lt-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr]">
        <aside className="from-lt-primary to-lt-brand sticky top-0 hidden h-dvh border-r border-white/10 bg-gradient-to-b text-white lg:block">
          <Sidebar items={navItems} />
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--lt-border)] bg-[rgba(246,249,252,0.78)] backdrop-blur-[10px]">
            <TopbarClient navItems={navItems} me={me} />
          </header>
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
