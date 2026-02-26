import { requireMe } from "@/server/bff/requireMe";
import PesquisasScreen from "@/features/feedback/PesquisasScreen";

export default async function PesquisasPage() {
    await requireMe("/app/feedback/pesquisas");
    return <PesquisasScreen />;
}
