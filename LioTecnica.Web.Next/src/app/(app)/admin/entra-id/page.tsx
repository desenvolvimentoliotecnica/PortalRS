"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminEntraIdScreen from "@/features/admin/entra-id/AdminEntraIdScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminEntraIdScreen />
    </AuthGuard>
  );
}
