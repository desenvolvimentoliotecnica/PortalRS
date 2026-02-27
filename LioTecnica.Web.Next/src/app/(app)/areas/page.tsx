"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AreasScreen from "@/features/cadastros/areas/AreasScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AreasScreen />
    </AuthGuard>
  );
}
