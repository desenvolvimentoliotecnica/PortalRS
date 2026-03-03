"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GestaoHumorScreen from "@/features/feedback/gestao/GestaoHumorScreen";

export default function Page() {
    return (
        <AuthGuard>
            <GestaoHumorScreen />
        </AuthGuard>
    );
}
