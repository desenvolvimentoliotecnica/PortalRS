"use client";

import { AuthGuard } from "@/hooks/useAuth";
import GestaoModuleScreen from "@/features/gestao/GestaoModuleScreen";

export default function Page() {
    return (
        <AuthGuard>
            <GestaoModuleScreen initialTab="dashboard" />
        </AuthGuard>
    );
}
