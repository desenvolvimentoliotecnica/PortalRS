"use client";

import { AuthGuard } from "@/hooks/useAuth";
import RegrasAprovacaoVagaScreen from "@/features/admin/regras-aprovacao-vaga/RegrasAprovacaoVagaScreen";

export default function Page() {
    return (
        <AuthGuard>
            <RegrasAprovacaoVagaScreen />
        </AuthGuard>
    );
}
