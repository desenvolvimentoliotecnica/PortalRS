"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/hooks/useAuth";
import TenantConfiguracaoScreen from "@/features/admin/tenant-configuracao/TenantConfiguracaoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando configurações…</div>}>
                <TenantConfiguracaoScreen />
            </Suspense>
        </AuthGuard>
    );
}
