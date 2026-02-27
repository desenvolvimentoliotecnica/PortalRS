"use client";

import { AuthGuard } from "@/hooks/useAuth";
import VagasScreen from "@/features/recrutamento/vagas/VagasScreen";

export default function VagasClient() {
  return (
    <AuthGuard>
      <VagasScreen />
    </AuthGuard>
  );
}

