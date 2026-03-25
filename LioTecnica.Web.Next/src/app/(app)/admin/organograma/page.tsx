"use client";

import dynamic from "next/dynamic";
import { AuthGuard } from "@/hooks/useAuth";
import { useState } from "react";
import AdminHierarquiaScreen from "@/features/admin/hierarquia/AdminHierarquiaScreen";
import AdminGestoresScreen from "@/features/admin/gestores/AdminGestoresScreen";
import RegrasAprovacaoVagaScreen from "@/features/admin/regras-aprovacao-vaga/RegrasAprovacaoVagaScreen";

// Lazy-load the React Flow canvas to avoid SSR issues
const OrganogramaCanvas = dynamic(
    () => import("@/features/admin/organograma/OrganogramaCanvas"),
    { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando canvas...</div> }
);

const TABS = [
    { id: "organograma", label: "Organograma" },
    { id: "niveis", label: "Níveis Hierárquicos" },
    { id: "gestores", label: "Gestores" },
    { id: "regras", label: "Regras de Aprovação" },
];

function OrganogramaPage() {
    const [activeTab, setActiveTab] = useState("organograma");

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            {/* Header */}
            <div className="border-b bg-white px-6 pt-5 pb-0">
                <h1 className="text-lg font-semibold text-gray-900 mb-3">Hierarquia & Organograma</h1>
                <nav className="flex gap-0">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={[
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab.id
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                            ].join(" ")}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === "organograma" && (
                    <div className="h-full">
                        <OrganogramaCanvas />
                    </div>
                )}
                {activeTab === "niveis" && (
                    <div className="h-full overflow-y-auto p-6">
                        <AdminHierarquiaScreen />
                    </div>
                )}
                {activeTab === "gestores" && (
                    <div className="h-full overflow-y-auto p-6">
                        <AdminGestoresScreen />
                    </div>
                )}
                {activeTab === "regras" && (
                    <div className="h-full overflow-y-auto p-6">
                        <RegrasAprovacaoVagaScreen />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <AuthGuard>
            <OrganogramaPage />
        </AuthGuard>
    );
}
