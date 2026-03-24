"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import IntegracaoOwnerScreen from "@/features/owner/IntegracaoOwnerScreen";

export default function Page() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <IntegracaoOwnerScreen />
      </Suspense>
    </AuthGuard>
  );
}
