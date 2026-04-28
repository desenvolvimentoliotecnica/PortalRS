"use client";

import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/hooks/useAuth";
import FuncionarioPerfil360Screen from "@/features/funcionarios/perfil/FuncionarioPerfil360Screen";

export default function FuncionarioPerfilPageClient() {
    const sp = useSearchParams();
    const id = sp?.get("id") ?? "";

    if (!id) {
        return <p className="text-muted-foreground text-center p-8">Funcionário não informado.</p>;
    }

    return (
        <AuthGuard>
            <FuncionarioPerfil360Screen id={id} />
        </AuthGuard>
    );
}
