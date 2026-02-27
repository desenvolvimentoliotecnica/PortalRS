"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CandidatosScreen from "@/features/recrutamento/candidatos/CandidatosScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CandidatosScreen />
    </AuthGuard>
  );
}
