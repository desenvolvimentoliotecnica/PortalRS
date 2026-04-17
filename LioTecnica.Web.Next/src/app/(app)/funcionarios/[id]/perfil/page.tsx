"use client";

import { use } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import FuncionarioPerfil360Screen from "@/features/funcionarios/perfil/FuncionarioPerfil360Screen";

export default function FuncionarioPerfilPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    return (
        <AuthGuard>
            <FuncionarioPerfil360Screen id={id} />
        </AuthGuard>
    );
}
