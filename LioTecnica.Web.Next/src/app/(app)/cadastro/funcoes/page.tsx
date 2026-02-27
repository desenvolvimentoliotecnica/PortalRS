"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FuncoesScreen from "@/features/cadastros/funcoes/FuncoesScreen";

export default function Page() {
  return (
    <AuthGuard>
      <FuncoesScreen />
    </AuthGuard>
  );
}
