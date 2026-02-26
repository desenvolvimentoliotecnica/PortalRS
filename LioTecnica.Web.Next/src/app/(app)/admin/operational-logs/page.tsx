import { requireMe } from "@/server/bff/requireMe";
import AdminOperationalLogsScreen from "@/features/admin/operational-logs/AdminOperationalLogsScreen";

export default async function AdminOperationalLogsPage() {
    await requireMe("/app/admin/operational-logs");
    return <AdminOperationalLogsScreen />;
}
