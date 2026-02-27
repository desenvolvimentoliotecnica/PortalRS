"use client";

import { AuthGuard } from "@/hooks/useAuth";
import IAScreen from "@/features/owner/IAScreen";

export default function Page() {
  return (
    <AuthGuard>
      <IAScreen />
    </AuthGuard>
  );
}
