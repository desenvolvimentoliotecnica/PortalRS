"use client";

import { AuthGuard } from "@/hooks/useAuth";
import DashboardScreen from "@/features/dashboard/DashboardScreen";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardScreen />
    </AuthGuard>
  );
}
