"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminLocalizationScreen from "@/features/admin/localization/AdminLocalizationScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminLocalizationScreen />
    </AuthGuard>
  );
}
