import { requireMe } from "@/server/bff/requireMe";
import PesquisaRapidaScreen from "@/features/feedback/PesquisaRapidaScreen";

export default async function PesquisaRapidaPage() {
    await requireMe("/app/feedback/pesquisarapida");
    return <PesquisaRapidaScreen />;
}
