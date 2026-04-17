"use client";

import { AuthGuard } from "@/hooks/useAuth";
import FuncionarioPerfil360Screen from "@/features/funcionarios/perfil/FuncionarioPerfil360Screen";

export default function FuncionarioPerfilPage({ params }: { params: { id: string } }) {
    return (
        <AuthGuard>
            <FuncionarioPerfil360Screen id={params.id} />
        </AuthGuard>
    );
}
