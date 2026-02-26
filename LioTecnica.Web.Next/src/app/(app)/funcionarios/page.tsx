import { requireMe } from "@/server/bff/requireMe";
import FuncionariosScreen from "@/features/cadastros/funcionarios/FuncionariosScreen";

export default async function FuncionariosPage() {
    await requireMe("/app/funcionarios");
    return <FuncionariosScreen />;
}
