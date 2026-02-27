"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FeedbacksScreen from "@/features/feedback/FeedbacksScreen";

export default function Page() {
  return (
    <AuthGuard>
      <FeedbacksScreen />
    </AuthGuard>
  );
}
