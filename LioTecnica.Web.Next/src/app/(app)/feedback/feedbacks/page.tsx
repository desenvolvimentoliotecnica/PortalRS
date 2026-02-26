import { requireMe } from "@/server/bff/requireMe";
import FeedbacksScreen from "@/features/feedback/FeedbacksScreen";

export default async function FeedbacksPage() {
    await requireMe("/app/feedback/feedbacks");
    return <FeedbacksScreen />;
}
