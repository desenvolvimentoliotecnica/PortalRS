"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminLogsScreen from "@/features/admin/logs/AdminLogsScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminLogsScreen />
    </AuthGuard>
  );
}
