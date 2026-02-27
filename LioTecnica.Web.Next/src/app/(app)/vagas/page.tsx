import { requireMe } from "@/server/bff/requireMe";
import VagasScreen from "@/features/recrutamento/vagas/VagasScreen";

export const dynamic = "force-static";

export default async function VagasPage() {
  await requireMe("/app/vagas");
  return <VagasScreen />;
}
