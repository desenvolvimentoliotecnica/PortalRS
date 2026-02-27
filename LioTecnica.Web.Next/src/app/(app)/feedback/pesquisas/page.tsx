"use client";

import { AuthGuard } from "@/hooks/useAuth";
import PesquisasScreen from "@/features/feedback/PesquisasScreen";

export default function Page() {
  return (
    <AuthGuard>
      <PesquisasScreen />
    </AuthGuard>
  );
}
