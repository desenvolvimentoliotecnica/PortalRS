"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AvaliacaoFormScreen from "@/features/feedback/AvaliacaoFormScreen";
import { useParams } from "next/navigation";

export default function AvaliacaoCicloPageClient() {
  const params = useParams();
  const cicloId = params.cicloId as string;

  return (
    <AuthGuard>
      <div className="p-6">
        <AvaliacaoFormScreen cicloId={cicloId} />
      </div>
    </AuthGuard>
  );
}
