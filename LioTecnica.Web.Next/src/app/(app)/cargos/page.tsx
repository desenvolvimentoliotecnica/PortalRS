import { requireMe } from "@/server/bff/requireMe";
import CargosScreen from "@/features/cadastros/cargos/CargosScreen";

export default async function CargosPage() {
    await requireMe("/app/cargos");
    return <CargosScreen />;
}
