"use client";

import { AuthGuard, useAuth } from "@/hooks/useAuth";
import EntradaEmailPastaScreen from "@/features/recrutamento/entradaemailpasta/EntradaEmailPastaScreen";

function EntradaInner() {
  const { me } = useAuth();
  return (
    <EntradaEmailPastaScreen
      tenantId={me?.tenantId ?? ""}
      initialVagas={[]}
      initialInbox={[]}
    />
  );
}

export default function EntradaEmailPastaPage() {
  return (
    <AuthGuard>
      <EntradaInner />
    </AuthGuard>
  );
}
