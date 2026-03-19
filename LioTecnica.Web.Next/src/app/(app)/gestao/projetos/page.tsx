"use client";

import { AuthGuard } from "@/hooks/useAuth";
import ProjetosScreen from "@/features/gestao/projetos/ProjetosScreen";

export default function Page() {
    return (
        <AuthGuard>
            <ProjetosScreen />
        </AuthGuard>
    );
}
