"use client";

import { AuthGuard } from "@/hooks/useAuth";
import EmptyState from "@/components/feedback/EmptyState";

export default function NotificacoesPage() {
  return (
    <AuthGuard>
      <EmptyState
        title="Notificações"
        description="A tela de notificações ainda não foi migrada."
      />
    </AuthGuard>
  );
}
