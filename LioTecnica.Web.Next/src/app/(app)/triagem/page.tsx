"use client";

import { AuthGuard } from "@/hooks/useAuth";
import TriagemScreen from "@/features/recrutamento/triagem/TriagemScreen";

export default function TriagemPage() {
  return (
    <AuthGuard>
      <TriagemScreen initialVagas={[]} initialCands={[]} />
    </AuthGuard>
  );
}
