import { requireMe } from "@/server/bff/requireMe";
import PessoasScreen from "@/features/cadastros/pessoas/PessoasScreen";

export default async function PessoasPage() {
  await requireMe("/app/pessoas");
  return <PessoasScreen />;
}

