"use client";

import { AuthGuard } from "@/hooks/useAuth";
import PreAdmissaoTrackingScreen from "@/features/admissao/PreAdmissaoTrackingScreen";
import { useParams } from "next/navigation";

export default function AdmissaoTrackingPageClient() {
  const params = useParams();
  const id = params.id as string;

  return (
    <AuthGuard>
      <div className="p-6 max-w-5xl mx-auto">
        <PreAdmissaoTrackingScreen id={id} />
      </div>
    </AuthGuard>
  );
}
