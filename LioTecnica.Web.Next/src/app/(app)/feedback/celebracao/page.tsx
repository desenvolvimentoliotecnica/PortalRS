"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CelebracaoScreen from "@/features/feedback/CelebracaoScreen";

export default function Page() {
  return (
    <AuthGuard>
      <CelebracaoScreen />
    </AuthGuard>
  );
}
