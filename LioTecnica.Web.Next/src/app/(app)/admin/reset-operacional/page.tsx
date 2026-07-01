"use client";

import { AuthGuard, RoleGuard } from "@/hooks/useAuth";
import ResetOperacionalScreen from "@/features/admin/reset-operacional/ResetOperacionalScreen";

export default function Page() {
  return (
    <AuthGuard>
      <RoleGuard minRole="owner">
        <ResetOperacionalScreen />
      </RoleGuard>
    </AuthGuard>
  );
}
