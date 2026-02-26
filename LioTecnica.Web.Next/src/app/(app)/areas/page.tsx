import { requireMe } from "@/server/bff/requireMe";
import AreasScreen from "@/features/cadastros/areas/AreasScreen";

export default async function AreasPage() {
    await requireMe("/app/areas");
    return <AreasScreen />;
}
