"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth, useHasPermission } from "@/hooks/useAuth";

function getRequiredPermission(pathname: string) {
    const normalizedPathname = pathname.startsWith("/app/")
        ? pathname.slice(4)
        : pathname;

    if (normalizedPathname.startsWith("/admin/documentacao-padrao")) {
        return "documentacao-padrao.manage";
    }

    return "access.manage";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { loading } = useAuth();
    const pathname = usePathname();
    const allowed = useHasPermission(getRequiredPermission(pathname));

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="border-lt-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="text-4xl">🔒</div>
                <p className="text-base font-semibold">Acesso negado</p>
                <p className="text-sm">Você não tem permissão para acessar esta área.</p>
            </div>
        );
    }

    return <>{children}</>;
}
