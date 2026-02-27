"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminEmailTemplatesScreen from "@/features/admin/email-templates/AdminEmailTemplatesScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminEmailTemplatesScreen />
    </AuthGuard>
  );
}
