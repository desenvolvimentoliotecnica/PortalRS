"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CiclosAvaliacaoScreen from "@/features/feedback/CiclosAvaliacaoScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CiclosAvaliacaoScreen />
    </AuthGuard>
  );
}
