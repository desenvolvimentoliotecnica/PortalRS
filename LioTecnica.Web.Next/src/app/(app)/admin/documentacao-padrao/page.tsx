"use client";

import { AuthGuard } from "@/hooks/useAuth";
import DocumentacaoPadraoScreen from "@/features/admin/documentacao-padrao/DocumentacaoPadraoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <DocumentacaoPadraoScreen />
        </AuthGuard>
    );
}
