"use client";

import { AuthGuard } from "@/hooks/useAuth";
import TalentosScreen from "@/features/recrutamento/talentos/TalentosScreen";

export default function TalentosPage() {
  return (
    <AuthGuard>
      <TalentosScreen initialList={null} initialVagas={[]} />
    </AuthGuard>
  );
}
