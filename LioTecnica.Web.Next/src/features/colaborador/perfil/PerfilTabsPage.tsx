"use client";

import React, { useState } from "react";
import { User, Users, FileText, Lock } from "lucide-react";
import PerfilScreen from "@/features/colaborador/perfil/PerfilScreen";
import DependentesScreen from "@/features/colaborador/dependentes/DependentesScreen";
import DocumentosScreen from "@/features/colaborador/documentos/DocumentosScreen";
import SenhaScreen from "@/features/colaborador/senha/SenhaScreen";

const TABS = [
    { id: "perfil", label: "Dados Pessoais", icon: User },
    { id: "dependentes", label: "Dependentes", icon: Users },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "senha", label: "Alterar Senha", icon: Lock },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PerfilTabsPage() {
    const [activeTab, setActiveTab] = useState<TabId>("perfil");

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-xl font-bold tracking-tight">Meu Perfil</h2>
                <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais, dependentes, documentos e segurança</p>
            </div>

            {/* ── Tab bar ── */}
            <div className="flex gap-1 border-b border-border/60 pb-0">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all
                                border-b-2 -mb-[1px]
                                ${isActive
                                    ? "border-violet-500 text-violet-700 bg-violet-50/50"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                }
                            `}
                        >
                            <Icon className="size-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Tab content ── */}
            <div className="pt-2">
                {activeTab === "perfil" && <PerfilScreen />}
                {activeTab === "dependentes" && <DependentesScreen />}
                {activeTab === "documentos" && <DocumentosScreen />}
                {activeTab === "senha" && <SenhaScreen />}
            </div>
        </section>
    );
}
