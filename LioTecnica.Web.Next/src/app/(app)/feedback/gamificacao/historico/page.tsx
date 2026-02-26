import { requireMe } from "@/server/bff/requireMe";
import GamificacaoHistoricoScreen from "@/features/feedback/GamificacaoHistoricoScreen";

export default async function GamificacaoHistoricoPage() {
    await requireMe("/app/feedback/gamificacao/historico");
    return <GamificacaoHistoricoScreen />;
}
