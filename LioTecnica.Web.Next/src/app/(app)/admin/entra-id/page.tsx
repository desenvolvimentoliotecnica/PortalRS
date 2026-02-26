import { requireMe } from "@/server/bff/requireMe";
import AdminEntraIdScreen from "@/features/admin/entra-id/AdminEntraIdScreen";

export default async function AdminEntraIdPage() {
    await requireMe("/app/admin/entra-id");
    return <AdminEntraIdScreen />;
}
