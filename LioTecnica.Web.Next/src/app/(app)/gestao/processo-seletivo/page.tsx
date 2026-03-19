"use client";

import { AuthGuard } from "@/hooks/useAuth";
import ProcessoSeletivoScreen from "@/features/gestao/processo-seletivo/ProcessoSeletivoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <ProcessoSeletivoScreen />
        </AuthGuard>
    );
}
