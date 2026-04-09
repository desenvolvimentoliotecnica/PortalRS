"use client";

import { AuthGuard } from "@/hooks/useAuth";
import TurnoCadastroScreen from "@/features/cadastros/totvs/TurnoCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <TurnoCadastroScreen />
    </AuthGuard>
  );
}
