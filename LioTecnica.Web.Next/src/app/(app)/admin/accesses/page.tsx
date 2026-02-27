"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminAccessesScreen from "@/features/admin/accesses/AdminAccessesScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminAccessesScreen />
    </AuthGuard>
  );
}
