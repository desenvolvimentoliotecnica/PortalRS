"use client";

import { AuthGuard } from "@/hooks/useAuth";
import SlaDashboardScreen from "@/features/recrutamento/sla/SlaDashboardScreen";

export default function Page() {
    return (
        <AuthGuard>
            <div className="p-6 max-w-5xl mx-auto">
                <SlaDashboardScreen />
            </div>
        </AuthGuard>
    );
}
