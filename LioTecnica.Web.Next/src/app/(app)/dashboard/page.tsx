"use client";

import { AuthGuard, useAuth } from "@/hooks/useAuth";
import DashboardScreen from "@/features/dashboard/DashboardScreen";
import ColaboradorDashboardScreen from "@/features/dashboard/ColaboradorDashboardScreen";

function DashboardContent() {
  const { me } = useAuth();

  const isColaborador =
    !!me &&
    !me.permissions.includes("*") &&
    !me.permissions.includes("access.manage") &&
    me.permissions.some((p) => p.startsWith("colaborador."));

  if (isColaborador) return <ColaboradorDashboardScreen />;

  return (
    <div className="space-y-10">
      <DashboardScreen />
      <ColaboradorDashboardScreen showHeader={false} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
