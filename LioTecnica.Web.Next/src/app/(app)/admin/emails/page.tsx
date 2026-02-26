import { requireMe } from "@/server/bff/requireMe";
import AdminEmailsScreen from "@/features/admin/emails/AdminEmailsScreen";

export default async function AdminEmailsPage() {
    await requireMe("/app/admin/emails");
    return <AdminEmailsScreen />;
}
