"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AgendasScreen from "@/features/recrutamento/agendas/AgendasScreen";

export default function Page() {
  return (
    <AuthGuard>
      <AgendasScreen />
    </AuthGuard>
  );
}
