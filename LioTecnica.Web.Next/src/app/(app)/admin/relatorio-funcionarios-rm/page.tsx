"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FuncionarioRmReportScreen from "@/features/admin/relatorios/FuncionarioRmReportScreen";

export default function FuncionarioRmReportPage() {
  return (
    <AuthGuard>
      <FuncionarioRmReportScreen />
    </AuthGuard>
  );
}
