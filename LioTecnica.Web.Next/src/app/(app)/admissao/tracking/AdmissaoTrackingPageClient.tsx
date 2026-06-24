"use client";

import { AuthGuard } from "@/hooks/useAuth";
import PreAdmissaoTrackingScreen from "@/features/admissao/PreAdmissaoTrackingScreen";
import { useSearchParams } from "next/navigation";

export default function AdmissaoTrackingPageClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";

  return (
    <AuthGuard>
      <div className="p-6 max-w-5xl mx-auto">
        {id ? (
          <PreAdmissaoTrackingScreen id={id} />
        ) : (
          <p className="text-sm text-muted-foreground">Pré-admissão não informada.</p>
        )}
      </div>
    </AuthGuard>
  );
}
