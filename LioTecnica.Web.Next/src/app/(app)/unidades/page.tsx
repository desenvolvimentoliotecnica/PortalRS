"use client";

import { AuthGuard } from "@/hooks/useAuth";
import UnidadesScreen from "@/features/cadastros/unidades/UnidadesScreen";

export default function UnidadesPage() {
    return (
        <AuthGuard>
            <UnidadesScreen />
        </AuthGuard>
    );
}
