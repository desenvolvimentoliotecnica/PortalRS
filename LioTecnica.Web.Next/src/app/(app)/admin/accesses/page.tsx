import { requireMe } from "@/server/bff/requireMe";
import AdminAccessesScreen from "@/features/admin/accesses/AdminAccessesScreen";

export default async function AdminAccessesPage() {
    await requireMe("/app/admin/accesses");
    return <AdminAccessesScreen />;
}
