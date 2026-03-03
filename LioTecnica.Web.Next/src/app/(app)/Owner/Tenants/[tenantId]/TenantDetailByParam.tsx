"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import TenantDetailScreen from "@/features/owner/TenantDetailScreen";

export default function TenantDetailByParam({ params }: { params: Promise<{ tenantId: string }> }) {
  const router = useRouter();
  const { tenantId } = use(params);

  useEffect(() => {
    if (tenantId && typeof window !== "undefined") {
      router.replace(`/Owner/Tenants?id=${encodeURIComponent(tenantId)}`);
    }
  }, [tenantId, router]);

  return <TenantDetailScreen tenantId={tenantId || ""} />;
}
