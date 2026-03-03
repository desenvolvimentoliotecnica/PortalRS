"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FeedbackInicioScreen from "@/features/feedback/FeedbackInicioScreen";

export default function FeedbackIndexPage() {
    return (
        <AuthGuard>
            <FeedbackInicioScreen />
        </AuthGuard>
    );
}
