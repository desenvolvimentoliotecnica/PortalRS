"use client";

import { AuthGuard } from "@/hooks/useAuth";
import NineBoxScreen from "@/features/feedback/nine-box/NineBoxScreen";

export default function Page() {
    return (
        <AuthGuard>
            <div className="p-6 max-w-6xl mx-auto">
                <NineBoxScreen />
            </div>
        </AuthGuard>
    );
}
