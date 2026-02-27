"use client";

import { AuthGuard } from "@/hooks/useAuth";
import EnviarFeedbackScreen from "@/features/feedback/EnviarFeedbackScreen";

export default function Page() {
  return (
    <AuthGuard>
      <EnviarFeedbackScreen />
    </AuthGuard>
  );
}
