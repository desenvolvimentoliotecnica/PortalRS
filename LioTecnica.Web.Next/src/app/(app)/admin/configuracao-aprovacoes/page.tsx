"use client";

import { AuthGuard } from "@/hooks/useAuth";
import ConfiguracaoAprovacoesScreen from "@/features/admin/configuracao-aprovacoes/ConfiguracaoAprovacoesScreen";

export default function Page() {
    return (
        <AuthGuard>
            <ConfiguracaoAprovacoesScreen />
        </AuthGuard>
    );
}
