"use client";

import { AuthGuard, useHasPermission, useIsAdminOrOwner } from "@/hooks/useAuth";
import RhContratacoesListScreen from "@/features/rh/contratacoes/RhContratacoesListScreen";

export default function RhContratacoesSelecaoPage() {
    const ok = useHasPermission("rh.contratacoes.selecao") || useHasPermission("rh.contratacoes.view") || useIsAdminOrOwner();
    return (
        <AuthGuard>
            {!ok ? (
                <div className="p-8 text-sm text-muted-foreground">Sem permissão para a área de seleção.</div>
            ) : (
                <RhContratacoesListScreen
                    title="Contratações — Seleção / RM"
                    subtitle="Integralização, processo seletivo e terminais pós‑RM."
                    statusPresets={[
                        { label: "Integração RM", codes: ["7", "14", "15", "16"] },
                        { label: "Processo seletivo", codes: ["17", "18"] },
                        { label: "Finais (SEL)", codes: ["19", "20"] },
                        { label: "Todos SEL+RM listados", codes: ["7", "14", "15", "16", "17", "18", "19", "20"] },
                    ]}
                />
            )}
        </AuthGuard>
    );
}
