"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminEmailConfigScreen from "@/features/admin/email-config/AdminEmailConfigScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminEmailConfigScreen />
    </AuthGuard>
  );
}
