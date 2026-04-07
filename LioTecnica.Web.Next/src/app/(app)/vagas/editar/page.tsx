"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import VagaEditPageClient from "./VagaEditPageClient";

export default function Page() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <VagaEditPageClient />
      </Suspense>
    </AuthGuard>
  );
}
