"use client";

import React, { useState } from "react";
import { User, Users, FileText, Lock, MapPin, Heart, Palmtree, CreditCard, Receipt, Briefcase } from "lucide-react";
import PerfilScreen from "@/features/colaborador/perfil/PerfilScreen";
import DocumentosScreen from "@/features/colaborador/documentos/DocumentosScreen";
import SenhaScreen from "@/features/colaborador/senha/SenhaScreen";
import EnderecoScreen from "@/features/colaborador/endereco/EnderecoScreen";
import SolicitacaoDependentesScreen from "@/features/colaborador/solicitacao-dependentes/SolicitacaoDependentesScreen";
import BeneficiosScreen from "@/features/colaborador/beneficios/BeneficiosScreen";
import FeriasScreen from "@/features/colaborador/ferias/FeriasScreen";
import DadosBancariosScreen from "@/features/colaborador/dados-bancarios/DadosBancariosScreen";
import HoleriteScreen from "@/features/colaborador/holerites/HoleriteScreen";
import HistoricoCarreiraScreen from "@/features/colaborador/historico-carreira/HistoricoCarreiraScreen";

const TABS = [
    { id: "perfil", label: "Dados Pessoais", icon: User },
    { id: "dependentes", label: "Dependentes", icon: Users },
    { id: "endereco", label: "Endereço", icon: MapPin },
    { id: "beneficios", label: "Benefícios", icon: Heart },
    { id: "ferias", label: "Férias", icon: Palmtree },
    { id: "dados-bancarios", label: "Dados Bancários", icon: CreditCard },
    { id: "holerites", label: "Holerites", icon: Receipt },
    { id: "historico-carreira", label: "Histórico", icon: Briefcase },
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
                <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais, solicitações, documentos e segurança</p>
            </div>

            {/* ── Tab bar ── */}
            <div className="flex gap-1 border-b border-border/60 pb-0 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap
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
                {activeTab === "dependentes" && <SolicitacaoDependentesScreen />}
                {activeTab === "endereco" && <EnderecoScreen />}
                {activeTab === "beneficios" && <BeneficiosScreen />}
                {activeTab === "ferias" && <FeriasScreen />}
                {activeTab === "dados-bancarios" && <DadosBancariosScreen />}
                {activeTab === "holerites" && <HoleriteScreen />}
                {activeTab === "historico-carreira" && <HistoricoCarreiraScreen />}
                {activeTab === "documentos" && <DocumentosScreen />}
                {activeTab === "senha" && <SenhaScreen />}
            </div>
        </section>
    );
}
