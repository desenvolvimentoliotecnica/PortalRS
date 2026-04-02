"use client";

import { RoleGuard } from "@/hooks/useAuth";
import SolicitacoesScreen from "@/features/gestao/solicitacoes/SolicitacoesScreen";

export default function Page() {
    return (
        <RoleGuard minRole="gestor">
            <SolicitacoesScreen />
        </RoleGuard>
    );
}
