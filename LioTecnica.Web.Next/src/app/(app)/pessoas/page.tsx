"use client";

import { AuthGuard } from "@/hooks/useAuth";
import PessoasScreen from "@/features/cadastros/pessoas/PessoasScreen";

export default function PessoasPage() {
  return (
    <AuthGuard>
      <PessoasScreen />
    </AuthGuard>
  );
}
