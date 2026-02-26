import { requireMe } from "@/server/bff/requireMe";
import UnidadesScreen from "@/features/cadastros/unidades/UnidadesScreen";

export default async function UnidadesPage() {
    await requireMe("/app/unidades");
    return <UnidadesScreen />;
}
