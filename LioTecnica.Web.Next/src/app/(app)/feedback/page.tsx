"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/hooks/useAuth";

function FeedbackRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/app/feedback/feedbacks");
    }, [router]);
    return null;
}

export default function FeedbackIndexPage() {
    return (
        <AuthGuard>
            <FeedbackRedirect />
        </AuthGuard>
    );
}
