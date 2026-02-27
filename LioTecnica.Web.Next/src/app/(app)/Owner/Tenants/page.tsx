import TenantsScreen from "@/features/owner/TenantsScreen";
import { requireMe } from "@/server/bff/requireMe";

export default async function OwnerTenantsPage() {
    await requireMe("/app/Owner/Tenants");
    return <TenantsScreen />;
}
