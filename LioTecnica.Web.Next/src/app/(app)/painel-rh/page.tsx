import { Suspense } from "react";

import WorkflowRHScreen from "@/features/recrutamento/workflow-rh/WorkflowRHScreen";

export default function PainelRhPage() {
  return (
    <Suspense fallback={null}>
      <WorkflowRHScreen />
    </Suspense>
  );
}
