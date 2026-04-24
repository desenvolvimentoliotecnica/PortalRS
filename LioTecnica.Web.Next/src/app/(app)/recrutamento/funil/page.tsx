"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FunilCandidaturasScreen from "@/features/recrutamento/funil/FunilCandidaturasScreen";

export default function Page() {
  return (
    <AuthGuard>
      <FunilCandidaturasScreen />
    </AuthGuard>
  );
}
