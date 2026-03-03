"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GestaoPlanosScreen from "@/features/feedback/gestao/GestaoPlanosScreen";

export default function Page() {
    return (
        <AuthGuard>
            <GestaoPlanosScreen />
        </AuthGuard>
    );
}
