"use client";

import { AuthGuard } from "@/hooks/useAuth";
import RmIntegracaoDashboardScreen from "@/features/relatorios/RmIntegracaoDashboardScreen";

export default function RmIntegracaoDashboardPage() {
  return (
    <AuthGuard>
      <RmIntegracaoDashboardScreen />
    </AuthGuard>
  );
}

