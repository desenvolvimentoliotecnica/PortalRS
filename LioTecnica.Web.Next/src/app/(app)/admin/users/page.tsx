"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminUsersScreen from "@/features/admin/users/AdminUsersScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminUsersScreen />
    </AuthGuard>
  );
}
