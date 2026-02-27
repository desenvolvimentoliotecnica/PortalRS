"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FuncionariosScreen from "@/features/cadastros/funcionarios/FuncionariosScreen";

export default function FuncionariosPage() {
    return (
        <AuthGuard>
            <FuncionariosScreen />
        </AuthGuard>
    );
}
