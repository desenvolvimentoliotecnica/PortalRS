import { requireMe } from "@/server/bff/requireMe";
import EnviarFeedbackScreen from "@/features/feedback/EnviarFeedbackScreen";

export default async function EnviarPage() {
    await requireMe("/app/feedback/enviar");
    return <EnviarFeedbackScreen />;
}
