import { requireMe } from "@/server/bff/requireMe";
import AgendasScreen from "@/features/recrutamento/agendas/AgendasScreen";

export default async function AgendasPage() {
  await requireMe("/app/agendas");
  return <AgendasScreen />;
}

