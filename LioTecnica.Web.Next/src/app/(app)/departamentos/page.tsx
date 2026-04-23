"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sessão 31.2 — consolidação Area+Department → CentroCusto.
 * A rota /app/departamentos foi mantida como alias que redireciona para /app/centros-custo,
 * preservando links antigos, bookmarks e deep-links de notificações.
 */
export default function DepartamentosRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/centros-custo");
  }, [router]);

  return null;
}
