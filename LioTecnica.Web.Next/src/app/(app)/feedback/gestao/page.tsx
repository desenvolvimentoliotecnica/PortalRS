import { requireMe } from "@/server/bff/requireMe";
import GestaoScreen from "@/features/feedback/GestaoScreen";

export default async function GestaoPage() {
    await requireMe("/app/feedback/gestao");
    return <GestaoScreen />;
}
