"use client";

import { AuthGuard } from "@/hooks/useAuth";
import TenantBrandingScreen from "@/features/admin/tenant-branding/TenantBrandingScreen";

export default function Page() {
  return (
    <AuthGuard>
      <TenantBrandingScreen />
    </AuthGuard>
  );
}
