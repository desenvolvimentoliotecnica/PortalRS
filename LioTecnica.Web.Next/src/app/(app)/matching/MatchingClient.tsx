"use client";

import { AuthGuard } from "@/hooks/useAuth";
import MatchingScreen from "@/features/recrutamento/matching/MatchingScreen";
import { useSearchParams } from "next/navigation";

function MatchingInner() {
  const sp = useSearchParams();
  const vagaId = sp.get("vagaId") ?? null;
  return <MatchingScreen initialVagas={[]} fixedVagaId={vagaId} />;
}

export default function MatchingClient() {
  return (
    <AuthGuard>
      <MatchingInner />
    </AuthGuard>
  );
}

