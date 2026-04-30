"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminRmRequisicaoStatusScreen from "@/features/admin/rm-requisicao-status/AdminRmRequisicaoStatusScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminRmRequisicaoStatusScreen />
    </AuthGuard>
  );
}
