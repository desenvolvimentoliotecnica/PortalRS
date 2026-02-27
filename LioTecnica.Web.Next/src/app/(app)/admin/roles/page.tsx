"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminRolesScreen from "@/features/admin/roles/AdminRolesScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminRolesScreen />
    </AuthGuard>
  );
}
