"use client";

import { AuthGuard } from "@/hooks/useAuth";
import UsuariosPerfisScreen from "@/features/usuariosperfis/UsuariosPerfisScreen";

export default function Page() {
    return (
        <AuthGuard>
            <UsuariosPerfisScreen />
        </AuthGuard>
    );
}
