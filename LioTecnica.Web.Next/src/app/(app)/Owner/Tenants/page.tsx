"use client";

import { AuthGuard } from "@/hooks/useAuth";
import TenantsScreen from "@/features/owner/TenantsScreen";

export default function Page() {
  return (
    <AuthGuard>
      <TenantsScreen />
    </AuthGuard>
  );
}
