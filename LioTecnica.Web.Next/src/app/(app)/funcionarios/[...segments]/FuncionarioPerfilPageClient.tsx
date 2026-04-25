"use client";

import { useParams } from "next/navigation";
import { AuthGuard } from "@/hooks/useAuth";
import FuncionarioPerfil360Screen from "@/features/funcionarios/perfil/FuncionarioPerfil360Screen";

export default function FuncionarioPerfilPageClient() {
    const { segments } = useParams<{ segments: string[] }>();
    const id = segments?.[0];

    return (
        <AuthGuard>
            <FuncionarioPerfil360Screen id={id} />
        </AuthGuard>
    );
}
