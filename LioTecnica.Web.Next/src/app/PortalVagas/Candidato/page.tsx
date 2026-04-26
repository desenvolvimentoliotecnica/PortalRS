"use client";

import { Suspense } from "react";
import PortalVagasCandidateWorkspace from "@/features/portalvagas/PortalVagasCandidateWorkspace";

export default function PortalVagasCandidatoPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted-foreground">Carregando...</div>}>
      <PortalVagasCandidateWorkspace />
    </Suspense>
  );
}
