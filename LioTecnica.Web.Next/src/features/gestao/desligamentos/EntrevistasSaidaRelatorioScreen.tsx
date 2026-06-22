"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    formatRespostaValor,
    getRelatorioEntrevistasSaida,
    type EntrevistaSaidaRelatorioItem,
} from "./entrevistaSaidaApi";

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return "—";
    }
}

export default function EntrevistasSaidaRelatorioScreen() {
    const [loading, setLoading] = useState(true);
    const [de, setDe] = useState("");
    const [ate, setAte] = useState("");
    const [totalEnviadas, setTotalEnviadas] = useState(0);
    const [totalRespondidas, setTotalRespondidas] = useState(0);
    const [itens, setItens] = useState<EntrevistaSaidaRelatorioItem[]>([]);
    const [selected, setSelected] = useState<EntrevistaSaidaRelatorioItem | null>(null);

    const taxaResposta = useMemo(() => {
        if (totalEnviadas === 0) return "0%";
        return `${Math.round((totalRespondidas / totalEnviadas) * 100)}%`;
    }, [totalEnviadas, totalRespondidas]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const relatorio = await getRelatorioEntrevistasSaida(de || undefined, ate || undefined);
            setTotalEnviadas(relatorio.totalEnviadas);
            setTotalRespondidas(relatorio.totalRespondidas);
            setItens(relatorio.itens ?? []);
        } catch (e) {
            toast.error(`Falha ao carregar relatório: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setLoading(false);
        }
    }, [de, ate]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
                        <Link href="/gestao/desligamentos">
                            <ArrowLeft className="size-4 mr-1" />
                            Voltar aos desligamentos
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-semibold tracking-tight">Entrevistas de saída respondidas</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Acompanhe envios, respostas e feedback dos colaboradores desligados.
                    </p>
                </div>
                <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
                    <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/40 bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground uppercase">Enviadas</div>
                    <div className="text-2xl font-semibold">{totalEnviadas}</div>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground uppercase">Respondidas</div>
                    <div className="text-2xl font-semibold">{totalRespondidas}</div>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground uppercase">Taxa de resposta</div>
                    <div className="text-2xl font-semibold">{taxaResposta}</div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Período (envio):</span>
                    <input
                        type="date"
                        value={de}
                        onChange={(e) => setDe(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <input
                        type="date"
                        value={ate}
                        onChange={(e) => setAte(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    />
                    <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
                        Filtrar
                    </Button>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Respondida em</TableHead>
                            <TableHead className="w-24" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : itens.length ? (
                            itens.map((item) => (
                                <TableRow key={item.entrevistaId}>
                                    <TableCell className="font-medium">{item.funcionarioNome}</TableCell>
                                    <TableCell>{formatDate(item.submittedAt)}</TableCell>
                                    <TableCell>
                                        <Button size="sm" variant="outline" onClick={() => setSelected(item)}>
                                            Ver respostas
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                    Nenhuma entrevista respondida no período.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Respostas — {selected?.funcionarioNome}</DialogTitle>
                        <DialogDescription>
                            Respondida em {formatDate(selected?.submittedAt)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {selected?.respostas.map((r, idx) => (
                            <div key={idx} className="rounded-md border border-border/40 p-3">
                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                    {r.pergunta}
                                </div>
                                <div className="text-sm">{formatRespostaValor(r)}</div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
