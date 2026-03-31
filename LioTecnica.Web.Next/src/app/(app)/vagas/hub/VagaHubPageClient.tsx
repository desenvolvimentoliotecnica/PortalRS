"use client";

import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/hooks/useAuth";
import VagaHubScreen from "@/features/recrutamento/vagas/VagaHubScreen";

export default function VagaHubPageClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  return (
    <AuthGuard>
      <VagaHubScreen vagaId={id} />
    </AuthGuard>
  );
}
