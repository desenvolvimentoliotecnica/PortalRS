"use client";

import { AuthGuard, useAuth } from "@/hooks/useAuth";
import DashboardScreen from "@/features/dashboard/DashboardScreen";
import ColaboradorDashboardScreen from "@/features/dashboard/ColaboradorDashboardScreen";
import AnalistaRhMockDashboardScreen from "@/features/dashboard/AnalistaRhMockDashboardScreen";

function normalizeRole(role: string) {
  return role
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function DashboardContent() {
  const { me } = useAuth();

  const isColaborador =
    !!me &&
    !me.permissions.includes("*") &&
    !me.permissions.includes("access.manage") &&
    me.permissions.some((p) => p.startsWith("colaborador."));
  const isAnalistaRh = me?.roles.some((role) => normalizeRole(role) === "analista de rh") ?? false;

  if (isColaborador) return <ColaboradorDashboardScreen />;
  if (isAnalistaRh) return <AnalistaRhMockDashboardScreen displayName={me?.displayName} />;

  return (
    <div className="space-y-10">
      <ColaboradorDashboardScreen showHeader={false} collapsible={true} />
      <DashboardScreen />
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
