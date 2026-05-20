"use client";

import { AuthGuard, useHasPermission, useIsAdminOrOwner } from "@/hooks/useAuth";
import RhContratacoesListScreen from "@/features/rh/contratacoes/RhContratacoesListScreen";

export default function RhContratacoesTriagemPage() {
    const ok = useHasPermission("rh.contratacoes.triagem") || useIsAdminOrOwner();
    return (
        <AuthGuard>
            {!ok ? (
                <div className="p-8 text-sm text-muted-foreground">Sem permissão para triagem de contratações.</div>
            ) : (
                <RhContratacoesListScreen
                    title="Contratações — Triagem"
                    subtitle="Fila de requisição de pessoal (aumento de quadro) — distinta do Kanban de candidaturas em /recrutamento/candidaturas."
                    statusPresets={[
                        { label: "Fila triagem", codes: ["11", "12", "13"] },
                        { label: "Pendente triagem", codes: ["11"] },
                        { label: "Em triagem", codes: ["12"] },
                        { label: "Devolvida", codes: ["13"] },
                    ]}
                />
            )}
        </AuthGuard>
    );
}
