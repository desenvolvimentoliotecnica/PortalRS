"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FuncionariosScreen from "@/features/cadastros/funcionarios/FuncionariosScreen";

export default function FuncionariosClient() {
    return (
        <AuthGuard>
            <FuncionariosScreen />
        </AuthGuard>
    );
}
