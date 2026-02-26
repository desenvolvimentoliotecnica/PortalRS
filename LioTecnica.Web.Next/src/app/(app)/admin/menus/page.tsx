import { requireMe } from "@/server/bff/requireMe";
import AdminMenusScreen from "@/features/admin/menus/AdminMenusScreen";

export default async function AdminMenusPage() {
    await requireMe("/app/admin/menus");
    return <AdminMenusScreen />;
}
