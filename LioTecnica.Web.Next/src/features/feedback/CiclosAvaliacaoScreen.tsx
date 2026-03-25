"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    Plus, RefreshCw, CheckCircle2, Clock, Lock, ClipboardList,
    ChevronRight, Trash2, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

/* ────── types ────── */

interface PerguntaResponse {
    id: string;
    texto: string;
    ordem: number;
}

interface CicloResponse {
    id: string;
    nome: string;
    periodo: string;
    status: number; // 0=Aberto, 1=Fechado
    criadoPorNome: string;
    totalPerguntas: number;
    totalRespostas: number;
    criadoEmUtc: string;
    perguntas: PerguntaResponse[];
}

interface ResultadoRow {
    avaliandoId: string;
    avaliandoNome: string;
    cargo: string | null;
    score: number;
    totalRespostas: number;
    ultimaRespostaEmUtc: string;
}

/* ────── helpers ────── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
}

function ScoreBar({ score }: { score: number }) {
    const pct = Math.min(100, (score / 5) * 100);
    const color = score >= 4 ? "bg-green-500" : score >= 3 ? "bg-blue-500" : score >= 2 ? "bg-amber-500" : "bg-red-400";
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold w-8 text-right">{score.toFixed(1)}</span>
        </div>
    );
}

/* ────── main component ────── */

export default function CiclosAvaliacaoScreen() {
    const router = useRouter();
    const { me } = useAuth();
    const isAdmin = me?.isAdmin ?? false;

    const [ciclos, setCiclos] = useState<CicloResponse[]>([]);
    const [loading, setLoading] = useState(true);

    /* criar ciclo */
    const [criarOpen, setCriarOpen] = useState(false);
    const [criarNome, setCriarNome] = useState("");
    const [criarPeriodo, setCriarPeriodo] = useState("");
    const [criarPerguntas, setCriarPerguntas] = useState<string[]>(["", "", ""]);
    const [criarLoading, setCriarLoading] = useState(false);

    /* resultados */
    const [resultadosOpen, setResultadosOpen] = useState(false);
    const [resultadosCiclo, setResultadosCiclo] = useState<CicloResponse | null>(null);
    const [resultados, setResultados] = useState<ResultadoRow[]>([]);
    const [resultadosLoading, setResultadosLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<CicloResponse[]>("/api/avaliacao/ciclos");
            setCiclos(data ?? []);
        } catch {
            toast.error("Falha ao carregar ciclos.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function criarCiclo() {
        const perguntas = criarPerguntas.filter(p => p.trim());
        if (!criarNome.trim()) { toast.error("Informe o nome do ciclo."); return; }
        if (!criarPeriodo.trim()) { toast.error("Informe o período."); return; }
        if (perguntas.length === 0) { toast.error("Adicione ao menos uma pergunta."); return; }
        setCriarLoading(true);
        try {
            await fetchJson("/api/avaliacao/ciclos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: criarNome.trim(), periodo: criarPeriodo.trim(), perguntas }),
            });
            toast.success("Ciclo criado!");
            setCriarOpen(false);
            setCriarNome(""); setCriarPeriodo(""); setCriarPerguntas(["", "", ""]);
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setCriarLoading(false);
        }
    }

    async function fecharCiclo(id: string) {
        if (!confirm("Fechar este ciclo? Após fechar não será possível registrar mais respostas.")) return;
        try {
            await fetchJson(`/api/avaliacao/ciclos/${id}/fechar`, { method: "POST" });
            toast.success("Ciclo fechado.");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function openResultados(ciclo: CicloResponse) {
        setResultadosCiclo(ciclo);
        setResultadosOpen(true);
        setResultadosLoading(true);
        try {
            const data = await fetchJson<ResultadoRow[]>(`/api/avaliacao/ciclos/${ciclo.id}/resultados`);
            setResultados(data ?? []);
        } catch {
            toast.error("Falha ao carregar resultados.");
        } finally {
            setResultadosLoading(false);
        }
    }

    const updatePergunta = (idx: number, val: string) => {
        const updated = [...criarPerguntas];
        updated[idx] = val;
        setCriarPerguntas(updated);
    };

    return (
        <section className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Desempenho
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Ciclos de Avaliação</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Avaliações formais de desempenho com perguntas configuradas e escala 1-5.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4 mr-1" /> Atualizar</Button>
                    {isAdmin && (
                        <Button size="sm" onClick={() => setCriarOpen(true)}>
                            <Plus className="size-4 mr-1" /> Novo Ciclo
                        </Button>
                    )}
                </div>
            </div>

            {/* Lista de ciclos */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
            ) : ciclos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ClipboardList className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Nenhum ciclo criado ainda.</p>
                    {isAdmin && (
                        <Button className="mt-4" size="sm" onClick={() => setCriarOpen(true)}>
                            <Plus className="size-4 mr-1" /> Criar primeiro ciclo
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {ciclos.map((ciclo) => {
                        const fechado = ciclo.status === 1;
                        return (
                            <div key={ciclo.id} className="rounded-xl border border-border/40 bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {fechado
                                            ? <Lock className="size-4 text-muted-foreground shrink-0" />
                                            : <Clock className="size-4 text-blue-500 shrink-0" />}
                                        <span className="font-semibold text-sm">{ciclo.nome}</span>
                                        <Badge variant={fechado ? "secondary" : "default"} className="text-xs">
                                            {fechado ? "Fechado" : "Aberto"}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        Período: {ciclo.periodo} · {ciclo.totalPerguntas} pergunta{ciclo.totalPerguntas !== 1 ? "s" : ""} · {ciclo.totalRespostas} resposta{ciclo.totalRespostas !== 1 ? "s" : ""} · Criado por {ciclo.criadoPorNome}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button variant="outline" size="sm" onClick={() => void openResultados(ciclo)}>
                                        <BarChart2 className="size-4 mr-1" /> Resultados
                                    </Button>
                                    {!fechado && (
                                        <Button size="sm" onClick={() => router.push(`/feedback/avaliacao/${ciclo.id}`)}>
                                            Responder <ChevronRight className="size-4 ml-1" />
                                        </Button>
                                    )}
                                    {!fechado && isAdmin && (
                                        <Button variant="outline" size="sm" onClick={() => void fecharCiclo(ciclo.id)}>
                                            <Lock className="size-4 mr-1" /> Fechar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Criar Ciclo Dialog */}
            <Dialog open={criarOpen} onOpenChange={setCriarOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Novo Ciclo de Avaliação</DialogTitle>
                        <DialogDescription>Configure o nome, período e as perguntas da avaliação (escala 1-5).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome *</label>
                            <Input placeholder="Ex: Avaliação Q1 2026" value={criarNome} onChange={(e) => setCriarNome(e.target.value)} className="mt-1" maxLength={200} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Período *</label>
                            <Input placeholder="Ex: Q1 2026, Semestral 2026..." value={criarPeriodo} onChange={(e) => setCriarPeriodo(e.target.value)} className="mt-1" maxLength={50} />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Perguntas (escala 1-5) *</label>
                                <Button variant="ghost" size="sm" onClick={() => setCriarPerguntas([...criarPerguntas, ""])}>
                                    <Plus className="size-3.5 mr-1" /> Adicionar
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {criarPerguntas.map((p, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <span className="text-xs text-muted-foreground pt-2.5 w-5 text-right shrink-0">{idx + 1}.</span>
                                        <Input
                                            placeholder={`Pergunta ${idx + 1}...`}
                                            value={p}
                                            onChange={(e) => updatePergunta(idx, e.target.value)}
                                            maxLength={500}
                                        />
                                        {criarPerguntas.length > 1 && (
                                            <Button variant="ghost" size="icon-xs" onClick={() => setCriarPerguntas(criarPerguntas.filter((_, i) => i !== idx))}>
                                                <Trash2 className="size-3.5 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCriarOpen(false)} disabled={criarLoading}>Cancelar</Button>
                        <Button onClick={() => void criarCiclo()} disabled={criarLoading || !criarNome.trim()}>
                            {criarLoading ? "Criando..." : "Criar Ciclo"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Resultados Dialog */}
            <Dialog open={resultadosOpen} onOpenChange={setResultadosOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Resultados — {resultadosCiclo?.nome}</DialogTitle>
                        <DialogDescription>Período: {resultadosCiclo?.periodo} · Score médio por avaliando</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        {resultadosLoading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
                        ) : resultados.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma resposta registrada ainda.</p>
                        ) : (
                            <div className="space-y-2">
                                {resultados.map((r, idx) => (
                                    <div key={r.avaliandoId} className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3">
                                        <span className="text-sm text-muted-foreground w-6 shrink-0">#{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold">{r.avaliandoNome}</div>
                                            <div className="text-xs text-muted-foreground">{r.cargo ?? "—"} · {r.totalRespostas} avaliador{r.totalRespostas !== 1 ? "es" : ""}</div>
                                        </div>
                                        <div className="w-40 shrink-0">
                                            <ScoreBar score={r.score} />
                                        </div>
                                        {r.score >= 4 && <CheckCircle2 className="size-4 text-green-500 shrink-0" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResultadosOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
