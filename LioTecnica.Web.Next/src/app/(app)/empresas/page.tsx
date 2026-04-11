"use client";

import { AuthGuard } from "@/hooks/useAuth";
import EmpresaCadastroScreen from "@/features/cadastros/totvs/EmpresaCadastroScreen";

export default function EmpresasPage() {
    return (
        <AuthGuard>
            <EmpresaCadastroScreen />
        </AuthGuard>
    );
}
