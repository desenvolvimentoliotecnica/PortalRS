import IAScreen from "@/features/owner/IAScreen";
import { requireMe } from "@/server/bff/requireMe";

export default async function OwnerIAPage() {
    await requireMe("/app/Owner/IA");
    return <IAScreen />;
}
