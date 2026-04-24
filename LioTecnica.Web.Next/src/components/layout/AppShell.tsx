"use client";

import { useEffect, useState, type ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { RouteAllowlistGuard } from "@/features/auth/RouteAllowlistGuard";
import { buildNavItemsForPermissions } from "@/features/navigation/permissionManifest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import type { BffNavItem } from "@/lib/schemas/bff";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { PendenciasProvider } from "@/contexts/PendenciasContext";
import FuncionarioDetailDialog from "@/features/cadastros/funcionarios/FuncionarioDetailDialog";

/* Owner-only synthetic menu items (not stored in the DB) */
const OWNER_NAV_ITEMS: BffNavItem[] = [
  { id: "__owner_tenants",   label: "Tenants",          href: "/Owner/Tenants",     icon: "building2",       openInNewTab: false, children: [] },
  { id: "__owner_ia",        label: "IA",                href: "/Owner/IA",          icon: "brain",           openInNewTab: false, children: [] },
  { id: "__owner_aws",       label: "Armazenamento S3",  href: "/Owner/AwsSettings", icon: "cloud-upload",    openInNewTab: false, children: [] },
  { id: "__owner_integracao", label: "Integração",       href: "/Owner/Integracao",  icon: "arrow-right-left", openInNewTab: false, children: [] },
];

function AppShellInner({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { isCollapsed } = useSidebar();
  const [navItems, setNavItems] = useState<BffNavItem[]>([]);
  const [globalFuncionarioId, setGlobalFuncionarioId] = useState<string | null>(null);

  useEffect(() => {
    if (!me) {
      setNavItems([]);
      return;
    }

    // Owner in owner context → only owner admin screens
    if (me.isOwnerContext) {
      setNavItems([...OWNER_NAV_ITEMS]);
      return;
    }

    // All other users: build nav from their permission set (code-first manifest).
    // Owner in tenant context has permissions=["*"] → sees all tenant items.
    // Admin/RH have all tenant permissions → see everything.
    // Gestor/Compliance have restricted permissions → see only their subset.
    setNavItems(buildNavItemsForPermissions(me.permissions ?? []));
  }, [me]);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setGlobalFuncionarioId(id);
    };
    window.addEventListener("renderrh:openFuncionario", handler);
    return () => window.removeEventListener("renderrh:openFuncionario", handler);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <aside
        className="from-lt-primary to-lt-brand sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-white/10 bg-gradient-to-b text-white lg:flex lg:flex-col z-10"
        style={{ width: isCollapsed ? 64 : 290, transition: "width 300ms ease" }}
      >
        <Sidebar items={navItems} />
      </aside>

      <main className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--lt-border)] bg-[rgba(246,249,252,0.78)] backdrop-blur-[10px]">
          <Topbar navItems={navItems} />
        </header>
        <div className="p-4 lg:p-6 flex-1">
          <RouteAllowlistGuard>{children}</RouteAllowlistGuard>
        </div>
        <FuncionarioDetailDialog
          funcionarioId={globalFuncionarioId}
          onClose={() => setGlobalFuncionarioId(null)}
        />
        <footer className="border-t border-[var(--lt-border)] px-4 py-3 text-center text-[11px] text-muted-foreground/50 select-none tracking-wide">
          © {new Date().getFullYear()} QUALIIT SOLUÇÕES EM TECNOLOGIA
        </footer>
      </main>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <PendenciasProvider>
          <AppShellInner>{children}</AppShellInner>
        </PendenciasProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
