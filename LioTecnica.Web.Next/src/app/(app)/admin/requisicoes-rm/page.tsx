"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminRmRequisicoesScreen from "@/features/admin/requisicoes-rm/AdminRmRequisicoesScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminRmRequisicoesScreen />
    </AuthGuard>
  );
}
