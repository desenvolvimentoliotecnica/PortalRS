import { requireMe } from "@/server/bff/requireMe";
import CandidatosScreen from "@/features/recrutamento/candidatos/CandidatosScreen";

export const dynamic = "force-static";

export default async function CandidatosPage() {
  await requireMe("/app/candidatos");
  return <CandidatosScreen />;
}
