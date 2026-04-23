"use client";

import { AuthGuard } from "@/hooks/useAuth";
import DescricaoCargoCadastroScreen from "@/features/cadastros/totvs/DescricaoCargoCadastroScreen";

export default function Page() {
  return (
    <AuthGuard>
      <DescricaoCargoCadastroScreen />
    </AuthGuard>
  );
}
