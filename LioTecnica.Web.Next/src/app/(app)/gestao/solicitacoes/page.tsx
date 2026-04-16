"use client";

import { useAuth, useHasPermission } from "@/hooks/useAuth";
import SolicitacoesScreen from "@/features/gestao/solicitacoes/SolicitacoesScreen";

export default function Page() {
    const { loading } = useAuth();
    const allowed = useHasPermission("solicitacoes-vaga.view");

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="border-lt-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="text-4xl">🔒</div>
                <p className="text-base font-semibold">Acesso negado</p>
                <p className="text-sm">Você não tem permissão para acessar esta área.</p>
            </div>
        );
    }

    return <SolicitacoesScreen />;
}
