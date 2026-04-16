"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getVisibleMenuHrefs, isHrefAllowed } from "@/features/navigation/menuPermissions";

/**
 * Bloqueia acesso direto por URL a rotas fora da allowlist do perfil.
 * Admin/Owner passam sem filtro. Gestor/Compliance são redirecionados para /dashboard
 * quando tentam abrir rota não permitida.
 */
export function RouteAllowlistGuard({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !me) return;
    const allowed = getVisibleMenuHrefs(me);
    if (!allowed) return;

    const normalized = pathname.replace(/^\/app(?=\/|$)/, "") || "/";
    if (isHrefAllowed(normalized, allowed)) return;

    router.replace("/dashboard");
  }, [loading, me, pathname, router]);

  return <>{children}</>;
}
