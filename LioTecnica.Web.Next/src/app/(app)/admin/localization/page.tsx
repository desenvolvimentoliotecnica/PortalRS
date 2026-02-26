import { requireMe } from "@/server/bff/requireMe";
import AdminLocalizationScreen from "@/features/admin/localization/AdminLocalizationScreen";

export default async function AdminLocalizationPage() {
    await requireMe("/app/admin/localization");
    return <AdminLocalizationScreen />;
}
