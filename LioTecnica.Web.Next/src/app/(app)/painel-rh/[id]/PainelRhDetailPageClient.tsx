"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import WorkflowRHDetailScreen from "@/features/recrutamento/workflow-rh/WorkflowRHDetailScreen";

export default function PainelRhDetailPageClient() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <WorkflowRHDetailScreen workflowId={id} />
    </Suspense>
  );
}
