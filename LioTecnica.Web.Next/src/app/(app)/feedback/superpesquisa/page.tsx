"use client";

import { AuthGuard } from "@/hooks/useAuth";
import SuperPesquisaScreen from "@/features/feedback/SuperPesquisaScreen";

export default function Page() {
  return (
    <AuthGuard>
      <SuperPesquisaScreen />
    </AuthGuard>
  );
}
