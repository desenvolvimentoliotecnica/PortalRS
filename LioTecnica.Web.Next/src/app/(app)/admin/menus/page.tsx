"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminMenusScreen from "@/features/admin/menus/AdminMenusScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminMenusScreen />
    </AuthGuard>
  );
}
