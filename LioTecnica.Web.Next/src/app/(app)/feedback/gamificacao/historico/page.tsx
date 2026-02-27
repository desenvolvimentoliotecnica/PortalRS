"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GamificacaoHistoricoScreen from "@/features/feedback/GamificacaoHistoricoScreen";

export default function Page() {
  return (
    <AuthGuard>
      <GamificacaoHistoricoScreen />
    </AuthGuard>
  );
}
