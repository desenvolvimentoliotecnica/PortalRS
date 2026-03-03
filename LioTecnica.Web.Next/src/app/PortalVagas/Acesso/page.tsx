"use client";

import { Suspense } from "react";
import PortalVagasAccessScreen from "@/features/portalvagas/PortalVagasAccessScreen";

export default function PortalVagasAcessoPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted-foreground">Carregando...</div>}>
      <PortalVagasAccessScreen />
    </Suspense>
  );
}

