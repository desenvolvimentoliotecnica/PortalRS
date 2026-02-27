import TenantDetailScreen from "@/features/owner/TenantDetailScreen";

export function generateStaticParams() {
    return [{ tenantId: "new" }];
}

export default async function TenantDetailPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;
    return <TenantDetailScreen tenantId={decodeURIComponent(tenantId)} />;
}
