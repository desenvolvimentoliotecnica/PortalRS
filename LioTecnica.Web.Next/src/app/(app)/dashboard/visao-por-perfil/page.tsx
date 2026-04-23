"use client";

import { AuthGuard } from "@/hooks/useAuth";
import DashboardVisaoPorPerfilScreen from "@/features/dashboard/DashboardVisaoPorPerfilScreen";

export default function DashboardVisaoPorPerfilPage() {
  return (
    <AuthGuard>
      <DashboardVisaoPorPerfilScreen />
    </AuthGuard>
  );
}
