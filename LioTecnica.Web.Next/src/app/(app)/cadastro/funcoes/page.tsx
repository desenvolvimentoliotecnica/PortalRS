import { requireMe } from "@/server/bff/requireMe";
import FuncoesScreen from "@/features/cadastros/funcoes/FuncoesScreen";

export default async function CadastroFuncoesPage() {
  await requireMe("/app/cadastro/funcoes");
  return <FuncoesScreen />;
}

