import { requireMe } from "@/server/bff/requireMe";
import AdminRolesScreen from "@/features/admin/roles/AdminRolesScreen";

export default async function AdminRolesPage() {
    await requireMe("/app/admin/roles");
    return <AdminRolesScreen />;
}
