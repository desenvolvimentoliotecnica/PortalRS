"use client";

import dynamic from "next/dynamic";
import { AuthGuard } from "@/hooks/useAuth";
import { Network } from "lucide-react";

// Lazy-load the React Flow canvas to avoid SSR issues
const OrganogramaCanvas = dynamic(
    () => import("@/features/admin/organograma/OrganogramaCanvas"),
    { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando canvas...</div> }
);

function OrganogramaPage() {
    return (
        <section className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Network className="size-5 text-muted-foreground" />
                    Organograma
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Visualize a estrutura hierárquica da organização.
                </p>
            </div>

            {/* Card com canvas */}
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden h-[calc(100dvh-220px)]">
                <OrganogramaCanvas />
            </div>
        </section>
    );
}

export default function Page() {
    return (
        <AuthGuard>
            <OrganogramaPage />
        </AuthGuard>
    );
}
