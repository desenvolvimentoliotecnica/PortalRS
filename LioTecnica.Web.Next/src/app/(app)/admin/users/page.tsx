import { requireMe } from "@/server/bff/requireMe";
import AdminUsersScreen from "@/features/admin/users/AdminUsersScreen";

export default async function AdminUsersPage() {
    await requireMe("/app/admin/users");
    return <AdminUsersScreen />;
}
