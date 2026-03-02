"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import CandidatoDetalhesScreen from "@/features/recrutamento/candidatos/CandidatoDetalhesScreen";

export default function Page() {
    return (
        <AuthGuard>
            <Suspense fallback={null}>
                <CandidatoDetalhesScreen />
            </Suspense>
        </AuthGuard>
    );
}
