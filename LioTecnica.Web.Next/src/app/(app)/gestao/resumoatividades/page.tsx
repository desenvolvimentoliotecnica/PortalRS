"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GestaoResumoScreen from "@/features/feedback/gestao/GestaoResumoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <GestaoResumoScreen />
        </AuthGuard>
    );
}
