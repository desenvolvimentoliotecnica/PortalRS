"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AprovadoresAlternativosScreen from "@/features/admin/aprovadores-alternativos/AprovadoresAlternativosScreen";

export default function Page() {
    return (
        <AuthGuard>
            <AprovadoresAlternativosScreen />
        </AuthGuard>
    );
}
