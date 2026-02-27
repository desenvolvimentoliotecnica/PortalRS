"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminEmailsScreen from "@/features/admin/emails/AdminEmailsScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminEmailsScreen />
    </AuthGuard>
  );
}
