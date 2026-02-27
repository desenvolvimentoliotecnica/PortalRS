"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GestaoScreen from "@/features/feedback/GestaoScreen";

export default function Page() {
  return (
    <AuthGuard>
      <GestaoScreen />
    </AuthGuard>
  );
}
