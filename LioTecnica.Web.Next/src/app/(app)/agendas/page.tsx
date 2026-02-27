import { requireMe } from "@/server/bff/requireMe";
import AgendasScreen from "@/features/recrutamento/agendas/AgendasScreen";

export const dynamic = "force-static";

export default async function AgendasPage() {
  await requireMe("/app/agendas");
  return <AgendasScreen />;
}

