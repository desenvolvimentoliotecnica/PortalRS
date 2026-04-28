"use client";

import { AuthGuard } from "@/hooks/useAuth";
import NineBoxScreen from "@/features/feedback/nine-box/NineBoxScreen";

export default function Page() {
    return (
        <AuthGuard>
            <NineBoxScreen />
        </AuthGuard>
    );
}
