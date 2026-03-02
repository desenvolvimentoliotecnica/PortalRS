"use client";

import { AuthGuard } from "@/hooks/useAuth";
import DesempenhoScreen from "@/features/desempenho/DesempenhoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <DesempenhoScreen />
        </AuthGuard>
    );
}
