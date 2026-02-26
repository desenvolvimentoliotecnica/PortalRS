import { redirect } from "next/navigation";
import { requireMe } from "@/server/bff/requireMe";

export default async function FeedbackIndexPage() {
    await requireMe("/app/feedback");
    redirect("/app/feedback/feedbacks");
}
