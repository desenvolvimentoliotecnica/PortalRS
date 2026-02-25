import { requireMe } from "@/server/bff/requireMe";
import CandidatosScreen from "@/features/recrutamento/candidatos/CandidatosScreen";

export default async function CandidatosPage() {
  await requireMe("/app/candidatos");
  return <CandidatosScreen />;
}
