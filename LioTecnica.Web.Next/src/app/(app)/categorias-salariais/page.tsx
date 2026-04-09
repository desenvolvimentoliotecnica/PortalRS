"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CategoriaSalarialCadastroScreen from "@/features/cadastros/totvs/CategoriaSalarialCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CategoriaSalarialCadastroScreen />
    </AuthGuard>
  );
}
