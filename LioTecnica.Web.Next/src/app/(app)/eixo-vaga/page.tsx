"use client";

import { AuthGuard } from "@/hooks/useAuth";
import EixoVagaCadastroScreen from "@/features/cadastros/totvs/EixoVagaCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <EixoVagaCadastroScreen />
    </AuthGuard>
  );
}
