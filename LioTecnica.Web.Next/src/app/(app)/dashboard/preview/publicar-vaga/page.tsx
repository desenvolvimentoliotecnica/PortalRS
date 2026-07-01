"use client";

import { AuthGuard } from "@/hooks/useAuth";
import PublicarVagaWizardPreviewScreen from "@/features/dashboard/preview/PublicarVagaWizardPreviewScreen";

/**
 * Rota oculta — wizard mockado para publicar vaga a partir de requisição.
 * Acesso: /app/dashboard/preview/publicar-vaga
 */
export default function PublicarVagaWizardPreviewPage() {
  return (
    <AuthGuard>
      <div className="flex h-[calc(100dvh-10.5rem)] min-h-0 flex-col overflow-hidden">
        <PublicarVagaWizardPreviewScreen />
      </div>
    </AuthGuard>
  );
}
