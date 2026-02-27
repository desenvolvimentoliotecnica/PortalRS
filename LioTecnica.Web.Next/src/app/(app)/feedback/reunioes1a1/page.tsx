"use client";

import { AuthGuard } from "@/hooks/useAuth";
import Reunioes1a1Screen from "@/features/feedback/Reunioes1a1Screen";

export default function Page() {
  return (
    <AuthGuard>
      <Reunioes1a1Screen />
    </AuthGuard>
  );
}
