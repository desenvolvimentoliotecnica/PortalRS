"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminApiKeysScreen from "@/features/admin/api-keys/AdminApiKeysScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminApiKeysScreen />
    </AuthGuard>
  );
}
