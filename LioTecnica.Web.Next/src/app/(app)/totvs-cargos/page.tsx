"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CargoCadastroScreen from "@/features/cadastros/totvs/CargoCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CargoCadastroScreen />
    </AuthGuard>
  );
}
