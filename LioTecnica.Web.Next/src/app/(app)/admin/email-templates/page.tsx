import { requireMe } from "@/server/bff/requireMe";
import AdminEmailTemplatesScreen from "@/features/admin/email-templates/AdminEmailTemplatesScreen";

export default async function AdminEmailTemplatesPage() {
    await requireMe("/app/admin/email-templates");
    return <AdminEmailTemplatesScreen />;
}
