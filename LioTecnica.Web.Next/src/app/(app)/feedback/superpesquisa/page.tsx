import { requireMe } from "@/server/bff/requireMe";
import SuperPesquisaScreen from "@/features/feedback/SuperPesquisaScreen";

export default async function SuperPesquisaPage() {
    await requireMe("/app/feedback/superpesquisa");
    return <SuperPesquisaScreen />;
}
