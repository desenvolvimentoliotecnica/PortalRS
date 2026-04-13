"use client";

import { AuthGuard } from "@/hooks/useAuth";
import NivelCargoCadastroScreen from "@/features/cadastros/totvs/NivelCargoCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <NivelCargoCadastroScreen />
    </AuthGuard>
  );
}
