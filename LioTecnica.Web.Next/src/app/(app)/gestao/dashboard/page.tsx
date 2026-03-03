"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GestaoDashboardScreen from "@/features/feedback/gestao/GestaoDashboardScreen";

export default function Page() {
    return (
        <AuthGuard>
            <GestaoDashboardScreen />
        </AuthGuard>
    );
}
