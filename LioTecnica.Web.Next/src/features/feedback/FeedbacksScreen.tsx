"use client";

import { useState } from "react";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    BarChart3,
    Inbox,
    MessageCircle,
    Send as SendIcon,
    Star,
} from "lucide-react";
import Link from "next/link";

const TABS = [
    { id: "received", label: "Recebidos", count: 0 },
    { id: "sent", label: "Enviados", count: 0 },
    { id: "sol-received", label: "Solicitações Recebidas", count: 0 },
    { id: "sol-sent", label: "Solicitações Enviadas", count: 0 },
] as const;

type TabId = (typeof TABS)[number]["id"];

function EmptyTab({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="text-center py-8 text-muted-foreground">
            <div className="mx-auto mb-2 opacity-30">{icon}</div>
            <div className="fw-bold mt-2">Não encontramos nada por aqui</div>
            <div className="text-sm">{text}</div>
        </div>
    );
}

export default function FeedbacksScreen() {
    const [activeTab, setActiveTab] = useState<TabId>("received");

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Feedbacks</h4>
                    <div className="text-muted-foreground text-sm">
                        Dê, solicite e receba feedbacks precisos de uma maneira confidencial e construtiva
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button className="btn-ghost" disabled title="Em breve">
                        <Inbox className="size-4 mr-1" />
                        Solicitar Feedback
                    </button>
                    <Link href="/app/feedback/enviar" className="btn-brand">
                        <SendIcon className="size-4 mr-1" />
                        Enviar Feedback
                    </Link>
                </div>
            </div>

            {/* Filtros */}
            <div className="card-soft p-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="form-label small mb-1">De</label>
                        <input type="date" className="form-control" disabled />
                    </div>
                    <div>
                        <label className="form-label small mb-1">Até</label>
                        <input type="date" className="form-control" disabled />
                    </div>
                    <div className="flex gap-2">
                        <button className="btn-ghost" disabled>Limpar</button>
                        <button className="btn-brand" disabled>Filtrar</button>
                    </div>
                    <div className="ml-auto">
                        <input
                            type="search"
                            className="form-control"
                            placeholder="Buscar..."
                            disabled
                        />
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="card-soft p-3">
                    <div className="flex items-center gap-3">
                        <div className="iconbox">
                            <ArrowDownCircle className="size-5" />
                        </div>
                        <div>
                            <div className="text-muted-foreground text-sm">Feedbacks recebidos</div>
                            <div className="fw-bold text-xl">0</div>
                        </div>
                    </div>
                </div>
                <div className="card-soft p-3">
                    <div className="flex items-center gap-3">
                        <div className="iconbox">
                            <ArrowUpCircle className="size-5" />
                        </div>
                        <div>
                            <div className="text-muted-foreground text-sm">Feedbacks enviados</div>
                            <div className="fw-bold text-xl">0</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resumo por Item */}
            <div className="card-soft p-3">
                <h6 className="fw-bold mb-3">Resumo por Item</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {["Alinhamento Cultural", "Foco no Cliente"].map((name) => (
                        <div key={name} className="card-soft p-3">
                            <div className="fw-bold">{name}</div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-muted-foreground text-sm">Sua média:</span>
                                <span className="text-muted-foreground text-sm">Sem feedbacks</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-muted-foreground text-sm">Média empresa:</span>
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4].map((i) => (
                                        <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                                    ))}
                                    <Star className="size-4 fill-amber-400/50 text-amber-400" />
                                </div>
                                <span className="text-sm fw-bold ml-1">4.7</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Resumo Mensal */}
            <div className="card-soft p-3">
                <h6 className="fw-bold mb-2">Resumo Mensal</h6>
                <div className="text-muted-foreground text-sm">
                    <BarChart3 className="size-4 inline mr-1" />
                    Sem feedbacks o suficiente para fazer a análise
                </div>
            </div>

            {/* Tabs */}
            <div className="card-soft p-3">
                <div className="flex gap-0 border-b border-border mb-3">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`px-3 py-2 text-sm border-b-2 transition-colors ${activeTab === tab.id
                                    ? "border-primary text-primary fw-bold"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {activeTab === "received" && (
                    <EmptyTab
                        icon={<MessageCircle className="size-8 mx-auto" />}
                        text="Nenhum feedback recebido no período selecionado"
                    />
                )}
                {activeTab === "sent" && (
                    <EmptyTab
                        icon={<MessageCircle className="size-8 mx-auto" />}
                        text="Nenhum feedback enviado no período selecionado"
                    />
                )}
                {activeTab === "sol-received" && (
                    <EmptyTab
                        icon={<Inbox className="size-8 mx-auto" />}
                        text="Nenhuma solicitação recebida no período selecionado"
                    />
                )}
                {activeTab === "sol-sent" && (
                    <EmptyTab
                        icon={<SendIcon className="size-8 mx-auto" />}
                        text="Nenhuma solicitação enviada no período selecionado"
                    />
                )}
            </div>
        </section>
    );
}
