"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CategoriasScreen from "@/features/cadastros/categorias/CategoriasScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CategoriasScreen />
    </AuthGuard>
  );
}
