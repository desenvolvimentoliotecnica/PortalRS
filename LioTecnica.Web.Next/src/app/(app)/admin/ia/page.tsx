"use client";

import { AuthGuard } from "@/hooks/useAuth";
import IaConfigScreen from "@/features/admin/ia/IaConfigScreen";

export default function Page() {
    return (
        <AuthGuard>
            <IaConfigScreen />
        </AuthGuard>
    );
}
