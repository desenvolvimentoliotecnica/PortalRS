"use client";

import { AuthGuard } from "@/hooks/useAuth";
import ConfiguracoesHeadcountScreen from "@/features/admin/configuracoes-headcount/ConfiguracoesHeadcountScreen";

export default function Page() {
    return (
        <AuthGuard>
            <ConfiguracoesHeadcountScreen />
        </AuthGuard>
    );
}
