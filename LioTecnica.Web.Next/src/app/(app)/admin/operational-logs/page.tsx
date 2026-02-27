"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminOperationalLogsScreen from "@/features/admin/operational-logs/AdminOperationalLogsScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminOperationalLogsScreen />
    </AuthGuard>
  );
}
