import { requireMe } from "@/server/bff/requireMe";
import GamificacaoScreen from "@/features/feedback/GamificacaoScreen";

export default async function GamificacaoPage() {
    await requireMe("/app/feedback/gamificacao");
    return <GamificacaoScreen />;
}
