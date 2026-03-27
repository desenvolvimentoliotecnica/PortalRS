"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminAwsSettingsScreen from "@/features/admin/aws-settings/AdminAwsSettingsScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AdminAwsSettingsScreen />
    </AuthGuard>
  );
}
