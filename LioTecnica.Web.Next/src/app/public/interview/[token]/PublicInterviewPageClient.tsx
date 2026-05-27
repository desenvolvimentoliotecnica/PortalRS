"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import PublicInterviewScreen from "@/features/recrutamento/entrevistas-publicas/PublicInterviewScreen";

export default function PublicInterviewPageClient() {
  const { token } = useParams<{ token: string }>();
  return (
    <Suspense fallback={null}>
      <PublicInterviewScreen token={token} />
    </Suspense>
  );
}
