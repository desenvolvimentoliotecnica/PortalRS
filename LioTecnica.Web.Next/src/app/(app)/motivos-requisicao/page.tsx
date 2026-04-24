"use client";

import { AuthGuard } from "@/hooks/useAuth";
import MotivosRequisicaoVagaScreen from "@/features/cadastros/MotivosRequisicaoVagaScreen";

export default function Page() {
  return (
    <AuthGuard>
      <MotivosRequisicaoVagaScreen />
    </AuthGuard>
  );
}
