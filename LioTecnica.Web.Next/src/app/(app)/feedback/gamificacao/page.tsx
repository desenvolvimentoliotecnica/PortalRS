"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GamificacaoScreen from "@/features/feedback/GamificacaoScreen";

export default function Page() {
  return (
    <AuthGuard>
      <GamificacaoScreen />
    </AuthGuard>
  );
}
