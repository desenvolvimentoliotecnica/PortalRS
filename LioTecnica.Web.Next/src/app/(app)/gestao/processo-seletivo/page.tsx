"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import ProcessoSeletivoScreen from "@/features/gestao/processo-seletivo/ProcessoSeletivoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <Suspense fallback={null}>
                <ProcessoSeletivoScreen />
            </Suspense>
        </AuthGuard>
    );
}
