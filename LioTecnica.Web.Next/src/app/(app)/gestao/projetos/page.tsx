"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import ProjetosScreen from "@/features/gestao/projetos/ProjetosScreen";

export default function Page() {
    return (
        <AuthGuard>
            <Suspense fallback={null}>
                <ProjetosScreen />
            </Suspense>
        </AuthGuard>
    );
}
