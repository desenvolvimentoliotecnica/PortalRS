"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AnalistaRhHomePreviewScreen from "@/features/dashboard/preview/AnalistaRhHomePreviewScreen";

/**
 * Rota oculta (não aparece no menu) para avaliação do conceito de home do analista de RH.
 * Acesso direto: /app/dashboard/preview/home-analista-rh
 */
export default function AnalistaRhHomePreviewPage() {
  return (
    <AuthGuard>
      <AnalistaRhHomePreviewScreen />
    </AuthGuard>
  );
}
