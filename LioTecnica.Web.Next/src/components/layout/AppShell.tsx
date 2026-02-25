import type { ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { getNavigation } from "@/server/bff/navigation";

export default async function AppShell({ children }: { children: ReactNode }) {
  const navigation = await getNavigation().catch(() => ({ items: [] }));

  return (
    <div className="min-h-dvh">
      <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr]">
        <aside className="from-lt-primary to-lt-brand sticky top-0 hidden h-dvh border-r border-white/10 bg-gradient-to-b text-white lg:block">
          <Sidebar items={navigation.items} />
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--lt-border)] bg-[rgba(246,249,252,0.78)] backdrop-blur-[10px]">
            <Topbar navItems={navigation.items} />
          </header>
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
