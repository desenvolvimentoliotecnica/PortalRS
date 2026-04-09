"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CentroCustoCadastroScreen from "@/features/cadastros/totvs/CentroCustoCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CentroCustoCadastroScreen />
    </AuthGuard>
  );
}
