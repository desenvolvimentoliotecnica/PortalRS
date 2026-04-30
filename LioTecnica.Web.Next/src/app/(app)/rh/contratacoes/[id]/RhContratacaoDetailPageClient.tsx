"use client";

import { AuthGuard } from "@/hooks/useAuth";
import RhContratacaoDetailScreen from "@/features/rh/contratacoes/RhContratacaoDetailScreen";

export default function RhContratacaoDetailPageClient() {
    return (
        <AuthGuard>
            <RhContratacaoDetailScreen />
        </AuthGuard>
    );
}
