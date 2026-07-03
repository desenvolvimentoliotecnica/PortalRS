"use client";

import { AuthGuard } from "@/hooks/useAuth";
import SlaDashboardScreen from "@/features/recrutamento/sla/SlaDashboardScreen";

export default function Page() {
    return (
        <AuthGuard>
            <SlaDashboardScreen />
        </AuthGuard>
    );
}
