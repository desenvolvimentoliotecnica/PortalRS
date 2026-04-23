"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect — a rota foi renomeada para /sla-vagas (label "SLA de Vagas").
// Mantido como transitório para não quebrar bookmarks antigos. Remover em
// sessão dedicada quando garantia de migração dos consumidores.
export default function EixoVagaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sla-vagas");
  }, [router]);
  return null;
}
