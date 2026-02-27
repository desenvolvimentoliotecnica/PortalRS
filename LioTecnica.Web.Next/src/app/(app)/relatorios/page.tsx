"use client";

import { AuthGuard } from "@/hooks/useAuth";
import RelatoriosScreen from "@/features/relatorios/RelatoriosScreen";

export default function RelatoriosPage() {
  return (
    <AuthGuard>
      <RelatoriosScreen initialCatalog={[]} initialVagas={[]} />
    </AuthGuard>
  );
}
