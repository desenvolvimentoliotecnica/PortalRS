"use client";

import { AuthGuard } from "@/hooks/useAuth";
import EixoVagaCadastroScreen from "@/features/cadastros/totvs/EixoVagaCadastroScreen";

// Rota renomeada: "SLA de Vagas" (antes "Eixos de Vaga"). A entidade backend
// segue chamada EixoVaga internamente — apenas a UI foi atualizada. Bookmarks
// antigos em /eixo-vaga redirecionam para cá.
export default function Page() {
  return (
    <AuthGuard>
      <EixoVagaCadastroScreen />
    </AuthGuard>
  );
}
