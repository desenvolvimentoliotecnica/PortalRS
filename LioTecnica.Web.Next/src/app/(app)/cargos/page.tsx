"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CargosScreen from "@/features/cadastros/cargos/CargosScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CargosScreen />
    </AuthGuard>
  );
}
