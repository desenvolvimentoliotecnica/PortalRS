"use client";

import { AuthGuard } from "@/hooks/useAuth";
import AdminHierarquiaScreen from "@/features/admin/hierarquia/AdminHierarquiaScreen";

export default function Page() {
    return (
        <AuthGuard>
            <AdminHierarquiaScreen />
        </AuthGuard>
    );
}
