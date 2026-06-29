"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { useNavegacaoSidebar } from "@/features/navigation/NavegacaoSidebarProvider";
import { isRouteAllowedForUser } from "@/features/navigation/menuPermissions";

/**
 * Bloqueia acesso direto por URL a rotas fora da allowlist do perfil.
 * A allowlist vem do backend (`/api/navegacao/sidebar`) + permissões JWT.
 * Sub-rotas (ex.: `/admissao/tracking/{id}`) herdam o prefixo do menu pai.
 *
 * Owner/Admin/Wildcard passam sem filtro (visibleHrefs=null). Demais perfis
 * são redirecionados para /dashboard ao tentar abrir rota não permitida.
 */
export function RouteAllowlistGuard({ children }: { children: ReactNode }) {
  const { me, loading: authLoading } = useAuth();
  const { visibleHrefs, loading: navLoading } = useNavegacaoSidebar();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || navLoading || !me) return;

    if (!visibleHrefs) return; // sem restrição (owner/admin/wildcard)

    if (isRouteAllowedForUser(pathname, visibleHrefs, me.permissions ?? [])) return;

    router.replace("/dashboard");
  }, [authLoading, navLoading, me, pathname, router, visibleHrefs]);

  return <>{children}</>;
}
