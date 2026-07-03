"use client";

import { AuthGuard } from "@/hooks/useAuth";
import SlaEtapaConfigScreen from "@/features/recrutamento/sla/SlaEtapaConfigScreen";

export default function Page() {
    return (
        <AuthGuard>
            <SlaEtapaConfigScreen />
        </AuthGuard>
    );
}
