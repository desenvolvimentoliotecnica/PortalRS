"use client";

import { AuthGuard } from "@/hooks/useAuth";
import DesempenhoMinhasAvaliacoesScreen from "@/features/feedback/desempenho/DesempenhoMinhasAvaliacoesScreen";

export default function Page() {
    return (
        <AuthGuard>
            <DesempenhoMinhasAvaliacoesScreen />
        </AuthGuard>
    );
}
