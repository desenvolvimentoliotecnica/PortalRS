"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import MatchingScreen from "@/features/recrutamento/matching/MatchingScreen";
import { useSearchParams } from "next/navigation";

const MATCHING_LAST_VAGA_KEY = "renderrh.matching.lastVagaId";

function MatchingInner() {
  const sp = useSearchParams();
  const [fallbackVagaId, setFallbackVagaId] = useState<string | null>(null);
  const vagaIdFromQuery = sp.get("vagaId") ?? sp.get("id") ?? null;

  useEffect(() => {
    const fromWindow = (() => {
      if (typeof window === "undefined") return null;
      const qs = new URLSearchParams(window.location.search || "");
      return qs.get("vagaId") ?? qs.get("id");
    })();

    const resolvedFromQuery = vagaIdFromQuery ?? fromWindow;
    if (resolvedFromQuery) {
      try {
        sessionStorage.setItem(MATCHING_LAST_VAGA_KEY, resolvedFromQuery);
        localStorage.setItem(MATCHING_LAST_VAGA_KEY, resolvedFromQuery);
      } catch {
        // ignore storage errors
      }
      setFallbackVagaId(resolvedFromQuery);
      return;
    }
    try {
      const savedSession = sessionStorage.getItem(MATCHING_LAST_VAGA_KEY);
      const savedLocal = localStorage.getItem(MATCHING_LAST_VAGA_KEY);
      const saved = (savedSession && savedSession.trim()) || (savedLocal && savedLocal.trim()) || "";
      setFallbackVagaId(saved || null);
    } catch {
      setFallbackVagaId(null);
    }
  }, [vagaIdFromQuery]);

  return <MatchingScreen initialVagas={[]} fixedVagaId={vagaIdFromQuery ?? fallbackVagaId} />;
}

export default function MatchingClient() {
  return (
    <AuthGuard>
      <MatchingInner />
    </AuthGuard>
  );
}

