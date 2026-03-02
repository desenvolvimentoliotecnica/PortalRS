"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/hooks/useAuth";
import TenantsScreen from "@/features/owner/TenantsScreen";
import TenantDetailScreen from "@/features/owner/TenantDetailScreen";

function TenantPageContent() {
  const sp = useSearchParams();
  const id = sp.get("id");

  if (id) {
    return <TenantDetailScreen tenantId={id} />;
  }

  return <TenantsScreen />;
}

export default function Page() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <TenantPageContent />
      </Suspense>
    </AuthGuard>
  );
}
