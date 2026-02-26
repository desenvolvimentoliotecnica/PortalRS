import { requireMe } from "@/server/bff/requireMe";
import CategoriasScreen from "@/features/cadastros/categorias/CategoriasScreen";

export default async function CategoriasPage() {
    await requireMe("/app/categorias");
    return <CategoriasScreen />;
}
