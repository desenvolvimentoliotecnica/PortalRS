import { requireMe } from "@/server/bff/requireMe";
import AdminEmailConfigScreen from "@/features/admin/email-config/AdminEmailConfigScreen";

export default async function AdminEmailConfigPage() {
    await requireMe("/app/admin/email-config");
    return <AdminEmailConfigScreen />;
}
