"use client";

import { AuthGuard } from "@/hooks/useAuth";
import MetasScreen from "@/features/feedback/MetasScreen";

export default function Page() {
    return (
        <AuthGuard>
            <div className="p-6 max-w-5xl mx-auto">
                <MetasScreen />
            </div>
        </AuthGuard>
    );
}
