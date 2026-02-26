import { requireMe } from "@/server/bff/requireMe";
import MeusPlanosScreen from "@/features/feedback/MeusPlanosScreen";

export default async function MeusPlanosPage() {
    await requireMe("/app/feedback/meusplanos");
    return <MeusPlanosScreen />;
}
