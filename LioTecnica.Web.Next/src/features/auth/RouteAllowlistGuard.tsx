"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { useNavegacaoSidebar } from "@/features/navigation/NavegacaoSidebarProvider";
import { isHrefAllowed } from "@/features/navigation/menuPermissions";

const RETIRED_ROUTES = new Set(["/gestao/aprovacoes", "/gestao/solicitacoes"]);

/**
 * Bloqueia acesso direto por URL a rotas fora da allowlist do perfil.
 * A allowlist agora vem do backend (`/api/navegacao/sidebar`), via o
 * `NavegacaoSidebarProvider` — um item é considerado permitido quando
 * aparece na resposta como acessível (sem motivoBloqueio).
 *
 * Owner/Admin/Wildcard passam sem filtro (visibleHrefs=null). Gestor/Compliance
 * são redirecionados para /dashboard ao tentar abrir rota não permitida.
 */
export function RouteAllowlistGuard({ children }: { children: ReactNode }) {
  const { me, loading: authLoading } = useAuth();
  const { visibleHrefs, loading: navLoading } = useNavegacaoSidebar();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || navLoading || !me) return;

    const normalized = pathname.replace(/^\/app(?=\/|$)/, "") || "/";
    const normalizedBase = normalized.toLowerCase().replace(/\/+$/, "") || "/";
    if (RETIRED_ROUTES.has(normalizedBase)) {
      router.replace("/dashboard");
      return;
    }

    if (!visibleHrefs) return; // sem restrição (owner/admin/wildcard)

    if (isHrefAllowed(normalized, visibleHrefs)) return;

    router.replace("/dashboard");
  }, [authLoading, navLoading, me, pathname, router, visibleHrefs]);

  return <>{children}</>;
}
