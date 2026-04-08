"use client";

import { AuthGuard } from "@/hooks/useAuth";
import UnidadeLotacaoCadastroScreen from "@/features/cadastros/totvs/UnidadeLotacaoCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <UnidadeLotacaoCadastroScreen />
    </AuthGuard>
  );
}
