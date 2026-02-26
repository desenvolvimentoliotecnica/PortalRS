import { requireMe } from "@/server/bff/requireMe";
import AdminApiKeysScreen from "@/features/admin/api-keys/AdminApiKeysScreen";

export default async function AdminApiKeysPage() {
    await requireMe("/app/admin/api-keys");
    return <AdminApiKeysScreen />;
}
