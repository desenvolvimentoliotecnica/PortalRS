"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminGestoresScreen from "@/features/admin/gestores/AdminGestoresScreen";

export default function Page() {
    return (
        <AuthGuard>
            <AdminGestoresScreen />
        </AuthGuard>
    );
}
