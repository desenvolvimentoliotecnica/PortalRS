import { requireMe } from "@/server/bff/requireMe";
import CelebracaoScreen from "@/features/feedback/CelebracaoScreen";

export default async function CelebracaoPage() {
    await requireMe("/app/feedback/celebracao");
    return <CelebracaoScreen />;
}
