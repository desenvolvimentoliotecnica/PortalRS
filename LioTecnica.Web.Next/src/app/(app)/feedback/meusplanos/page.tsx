"use client";

import { AuthGuard } from "@/hooks/useAuth";
import MeusPlanosScreen from "@/features/feedback/MeusPlanosScreen";

export default function Page() {
  return (
    <AuthGuard>
      <MeusPlanosScreen />
    </AuthGuard>
  );
}
