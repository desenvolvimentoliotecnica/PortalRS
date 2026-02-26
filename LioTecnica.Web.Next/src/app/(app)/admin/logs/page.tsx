import { requireMe } from "@/server/bff/requireMe";
import AdminLogsScreen from "@/features/admin/logs/AdminLogsScreen";

export default async function AdminLogsPage() {
    await requireMe("/app/admin/logs");
    return <AdminLogsScreen />;
}
