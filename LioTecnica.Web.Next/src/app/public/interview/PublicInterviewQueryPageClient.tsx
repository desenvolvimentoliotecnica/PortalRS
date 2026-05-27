"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PublicInterviewScreen from "@/features/recrutamento/entrevistas-publicas/PublicInterviewScreen";

function PublicInterviewQueryContent() {
  const sp = useSearchParams();
  const token = (sp.get("token") || "").trim();
  return <PublicInterviewScreen token={token} />;
}

export default function PublicInterviewQueryPageClient() {
  return (
    <Suspense fallback={null}>
      <PublicInterviewQueryContent />
    </Suspense>
  );
}
