import { Inbox } from "lucide-react";

import EmptyState from "@/components/feedback/EmptyState";

export const dynamic = "force-static";

export default function NotificacoesPage() {
  return (
    <EmptyState
      title="Notificações (em migração)"
      description="Por enquanto, as notificações seguem no legado. Esta rota será migrada depois."
      icon={<Inbox aria-hidden className="size-5" />}
    />
  );
}
