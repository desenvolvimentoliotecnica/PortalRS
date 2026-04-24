"use client";

import { useMemo, type ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import AssistenteIaFab from "@/components/layout/AssistenteIaFab";
import { RouteAllowlistGuard } from "@/features/auth/RouteAllowlistGuard";
import {
  NavegacaoSidebarProvider,
  useNavegacaoSidebar,
} from "@/features/navigation/NavegacaoSidebarProvider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import type { BffNavItem } from "@/lib/schemas/bff";
import type { NavGrupoResponse } from "@/lib/schemas/navegacao";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { PendenciasProvider } from "@/contexts/PendenciasContext";


/* ═══════════════════════════════════════════════════════════════════
   OWNER-ONLY synthetic menu items
   Quando o backend retorna contextoEspecial="owner-root" (owner puro
   sem tenant real), o frontend injeta os itens do painel de owner —
   eles não vivem no banco, nem no manifesto de navegação.
   ═══════════════════════════════════════════════════════════════════ */
const OWNER_NAV_ITEMS: BffNavItem[] = [
  { id: "__owner_tenants",    label: "Tenants",           href: "/Owner/Tenants",     icon: "building2",        openInNewTab: false, children: [] },
  { id: "__owner_ia",         label: "IA",                href: "/Owner/IA",          icon: "brain",            openInNewTab: false, children: [] },
  { id: "__owner_aws",        label: "Armazenamento S3",  href: "/Owner/AwsSettings", icon: "cloud-upload",     openInNewTab: false, children: [] },
  { id: "__owner_integracao", label: "Integração",        href: "/Owner/Integracao",  icon: "arrow-right-left", openInNewTab: false, children: [] },
];

const OWNER_ROOT_GROUPS: NavGrupoResponse[] = [
  {
    key: "owner-root",
    label: "Owner",
    ordem: 0,
    ocultarHeader: true,
    itens: OWNER_NAV_ITEMS.map((item, idx) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      icon: item.icon ?? null,
      ordem: idx,
      moduloKey: null,
      packageKey: null,
      acessivel: true,
      motivoBloqueio: null,
    })),
  },
];

function AppShellInner({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { isCollapsed } = useSidebar();
  const { grupos, isOwnerRoot } = useNavegacaoSidebar();

  // Owner-root: backend devolve grupos vazios + contextoEspecial="owner-root";
  // frontend injeta o menu sintético OWNER_NAV_ITEMS (não persiste em DB).
  const effectiveGrupos = useMemo<NavGrupoResponse[]>(() => {
    if (isOwnerRoot || (me?.isOwnerContext && grupos.length === 0)) {
      return OWNER_ROOT_GROUPS;
    }
    return grupos;
  }, [grupos, isOwnerRoot, me]);

  return (
    <div className="flex min-h-dvh">
      <aside
        className="from-lt-primary to-lt-brand sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-white/10 bg-gradient-to-b text-white lg:flex lg:flex-col z-10"
        style={{ width: isCollapsed ? 64 : 290, transition: "width 300ms ease" }}
      >
        <Sidebar grupos={effectiveGrupos} />
      </aside>

      <main className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--lt-border)] bg-[rgba(246,249,252,0.78)] backdrop-blur-[10px]">
          <Topbar grupos={effectiveGrupos} />
        </header>
        <div className="p-4 lg:p-6 flex-1">
          <RouteAllowlistGuard>{children}</RouteAllowlistGuard>
        </div>
        <AssistenteIaFab />
        <footer className="border-t border-[var(--lt-border)] px-4 py-3 text-center text-[11px] text-muted-foreground/50 select-none tracking-wide">
          © {new Date().getFullYear()} · Portal de RH
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
          <NavegacaoSidebarProvider>
            <AppShellInner>{children}</AppShellInner>
          </NavegacaoSidebarProvider>
        </PendenciasProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
