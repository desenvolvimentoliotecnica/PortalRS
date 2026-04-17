"use client";

import { AuthGuard } from "@/hooks/useAuth";
import MeuTimeScreen from "@/features/gestao/meu-time/MeuTimeScreen";

export default function Page() {
    return (
        <AuthGuard>
            <MeuTimeScreen />
        </AuthGuard>
    );
}
