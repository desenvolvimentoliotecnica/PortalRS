"use client";

import { AuthGuard } from "@/hooks/useAuth";
import TenantConfiguracaoScreen from "@/features/admin/tenant-configuracao/TenantConfiguracaoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <TenantConfiguracaoScreen />
        </AuthGuard>
    );
}
