"use client";

import { AuthGuard } from "@/hooks/useAuth";
import PesquisaRapidaScreen from "@/features/feedback/PesquisaRapidaScreen";

export default function Page() {
  return (
    <AuthGuard>
      <PesquisaRapidaScreen />
    </AuthGuard>
  );
}
