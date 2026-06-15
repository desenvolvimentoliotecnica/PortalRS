"use client";

import { AuthGuard } from "@/hooks/useAuth";
import ConfiguracaoRmScreen from "@/features/admin/configuracao-rm/ConfiguracaoRmScreen";

export default function Page() {
  return (
    <AuthGuard>
      <ConfiguracaoRmScreen />
    </AuthGuard>
  );
}
