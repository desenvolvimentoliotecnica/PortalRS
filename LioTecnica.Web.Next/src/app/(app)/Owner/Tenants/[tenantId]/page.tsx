import TenantDetailScreen from "@/features/owner/TenantDetailScreen";
import { requireMe } from "@/server/bff/requireMe";

export const dynamic = "force-static";

export default async function TenantDetailPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;
    await requireMe(`/app/Owner/Tenants/${tenantId}`);
    return <TenantDetailScreen tenantId={decodeURIComponent(tenantId)} />;
}
