"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API = "/api/colaborador/historico-carreira";

const MOTIVO_LABELS: Record<string, string> = {
    Desligamento: "Desligamento",
    Promocao: "Promoção",
    Transferencia: "Transferência",
    Manual: "Ajuste Manual",
};

interface HistoricoItem {
    id: string;
    vagaDescricao: string | null;
    cargoNome: string | null;
    areaNome: string | null;
    dataEntrada: string;
    dataSaida: string | null;
    motivoSaida: string | null;
    isProvisorio: boolean;
}

function formatDate(d: string | null) {
    if (!d) return "Atual";
    return new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export default function HistoricoCarreiraScreen() {
    const [historico, setHistorico] = useState<HistoricoItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch(API)
            .then((r) => r.json() as Promise<HistoricoItem[]>)
            .then((data) => setHistorico(Array.isArray(data) ? data : []))
            .catch(() => toast.error("Erro ao carregar histórico de carreira."))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Carregando histórico...
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Briefcase className="size-5 text-violet-600" />
                    <CardTitle className="text-base">Histórico de Carreira</CardTitle>
                </div>
                <CardDescription>
                    Suas movimentações de cargo e área ao longo do tempo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {historico.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                        Nenhum histórico de carreira registrado.
                    </p>
                ) : (
                    <ol className="relative border-l border-border/60 space-y-6 ml-3">
                        {historico.map((item, i) => (
                            <li key={item.id} className="ml-6">
                                <span className={`
                                    absolute -left-3 flex size-6 items-center justify-center rounded-full border-2
                                    ${!item.dataSaida
                                        ? "bg-violet-600 border-violet-600 text-white"
                                        : "bg-background border-border text-muted-foreground"
                                    }
                                `}>
                                    <Briefcase className="size-3" />
                                </span>

                                <div className="flex flex-wrap items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold leading-tight">
                                            {item.cargoNome ?? item.vagaDescricao ?? "Cargo não informado"}
                                        </p>
                                        {item.areaNome && (
                                            <p className="text-xs text-muted-foreground">{item.areaNome}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                            {formatDate(item.dataEntrada)}
                                            <ArrowRight className="size-3" />
                                            {formatDate(item.dataSaida)}
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {!item.dataSaida && (
                                            <Badge variant="default" className="bg-violet-600 text-xs">Atual</Badge>
                                        )}
                                        {item.isProvisorio && (
                                            <Badge variant="secondary" className="text-xs">Provisório</Badge>
                                        )}
                                        {item.motivoSaida && (
                                            <Badge variant="outline" className="text-xs">
                                                {MOTIVO_LABELS[item.motivoSaida] ?? item.motivoSaida}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}
