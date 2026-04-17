"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Download, ChevronDown, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API = "/api/colaborador/holerites";

const MESES = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface HoleriteItem {
    id: string;
    mesReferencia: number;
    anoReferencia: number;
    arquivoNome: string;
    tamanhoBytes: number;
    enviadoPorId: string | null;
    enviadoPorNome: string | null;
    enviadoEmUtc: string;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HoleriteScreen() {
    const [holerites, setHolerites] = useState<HoleriteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

    useEffect(() => {
        apiFetch(API)
            .then((r) => r.json() as Promise<HoleriteItem[]>)
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setHolerites(list);
                if (list.length > 0) {
                    setExpandedYears(new Set([list[0].anoReferencia]));
                }
            })
            .catch(() => toast.error("Erro ao carregar holerites."))
            .finally(() => setLoading(false));
    }, []);

    async function handleDownload(h: HoleriteItem) {
        setDownloading(h.id);
        try {
            const res = await fetch(`${API}/${h.id}/download`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
            });
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = h.arquivoNome;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Erro ao baixar holerite.");
        } finally {
            setDownloading(null);
        }
    }

    function toggleYear(year: number) {
        setExpandedYears((prev) => {
            const next = new Set(prev);
            next.has(year) ? next.delete(year) : next.add(year);
            return next;
        });
    }

    // Agrupa por ano
    const byYear = holerites.reduce<Record<number, HoleriteItem[]>>((acc, h) => {
        (acc[h.anoReferencia] ??= []).push(h);
        return acc;
    }, {});
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Carregando holerites...
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Receipt className="size-5 text-violet-600" />
                    <CardTitle className="text-base">Holerites</CardTitle>
                </div>
                <CardDescription>
                    Seus recibos de pagamento disponibilizados pelo RH ou pelo TOTVS.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {years.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                        Nenhum holerite disponível ainda.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {years.map((year) => {
                            const expanded = expandedYears.has(year);
                            const items = byYear[year].sort((a, b) => b.mesReferencia - a.mesReferencia);
                            return (
                                <div key={year} className="border rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleYear(year)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
                                    >
                                        <span className="flex items-center gap-2">
                                            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                            {year}
                                        </span>
                                        <Badge variant="secondary">{items.length} {items.length === 1 ? "mês" : "meses"}</Badge>
                                    </button>

                                    {expanded && (
                                        <div className="divide-y">
                                            {items.map((h) => (
                                                <div key={h.id} className="flex items-center justify-between px-4 py-3">
                                                    <div>
                                                        <p className="text-sm font-medium">{MESES[h.mesReferencia]} {h.anoReferencia}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatBytes(h.tamanhoBytes)} ·{" "}
                                                            {h.enviadoPorId
                                                                ? `Enviado por ${h.enviadoPorNome ?? "RH"}`
                                                                : "Enviado via TOTVS"
                                                            } ·{" "}
                                                            {new Date(h.enviadoEmUtc).toLocaleDateString("pt-BR")}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDownload(h)}
                                                        disabled={downloading === h.id}
                                                    >
                                                        <Download className="size-3.5 mr-1.5" />
                                                        {downloading === h.id ? "Baixando..." : "Download"}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
