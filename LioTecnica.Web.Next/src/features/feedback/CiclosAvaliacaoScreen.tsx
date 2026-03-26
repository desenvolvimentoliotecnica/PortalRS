"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    Plus, RefreshCw, CheckCircle2, Clock, Lock, ClipboardList,
    ChevronRight, Trash2, BarChart2, LayoutGrid,
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

    /* nine-box suggestion */
    const [nineBoxModal, setNineBoxModal] = useState<{ avaliandoId: string; avaliandoNome: string; cargo: string | null; desempenho: number } | null>(null);
    const [nineBoxPotencial, setNineBoxPotencial] = useState(2);
    const [savingNineBox, setSavingNineBox] = useState(false);

    function scoreToDesempenho(score: number): number {
        if (score >= 4) return 3;
        if (score >= 2.5) return 2;
        return 1;
    }

    const NINE_BOX_NAMES: Record<string, string> = {
        "1-1": "Questionável", "1-2": "Em Desenvolvimento", "1-3": "Enigma",
        "2-1": "Efetivo", "2-2": "Núcleo", "2-3": "Alto Potencial",
        "3-1": "Especialista", "3-2": "Alto Desempenho", "3-3": "Estrela",
    };

    async function salvarNineBox() {
        if (!nineBoxModal) return;
        setSavingNineBox(true);
        try {
            const res = await apiFetch("/api/nine-box", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: nineBoxModal.avaliandoId,
                    desempenho: nineBoxModal.desempenho,
                    potencial: nineBoxPotencial,
                    observacoes: `Posicionamento sugerido a partir da avaliação de desempenho. Score: ${resultados.find(r => r.avaliandoId === nineBoxModal.avaliandoId)?.score?.toFixed(1)}`,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const qKey = `${nineBoxModal.desempenho}-${nineBoxPotencial}`;
            toast.success(`${nineBoxModal.avaliandoNome} posicionado como "${NINE_BOX_NAMES[qKey] ?? qKey}" no Nine-Box!`);
            setNineBoxModal(null);
        } catch {
            toast.error("Erro ao salvar no Nine-Box.");
        } finally {
            setSavingNineBox(false);
        }
    }

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
                                        <button
                                            title="Sugerir posição Nine-Box"
                                            onClick={() => {
                                                setNineBoxPotencial(2);
                                                setNineBoxModal({ avaliandoId: r.avaliandoId, avaliandoNome: r.avaliandoNome, cargo: r.cargo, desempenho: scoreToDesempenho(r.score) });
                                            }}
                                            className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                                        >
                                            <LayoutGrid className="size-3" /> Nine-Box
                                        </button>
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

            {/* Nine-Box suggestion modal */}
            {nineBoxModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 border border-border">
                        <div className="flex items-center gap-2 mb-4">
                            <LayoutGrid className="size-5 text-primary" />
                            <h3 className="text-sm font-semibold">Posicionar no Nine-Box</h3>
                        </div>
                        <div className="text-sm font-medium mb-0.5">{nineBoxModal.avaliandoNome}</div>
                        <div className="text-xs text-muted-foreground mb-4">{nineBoxModal.cargo ?? "—"}</div>

                        <div className="rounded-lg bg-muted/40 p-3 mb-4 text-xs">
                            <div className="font-medium mb-1">Desempenho (calculado da avaliação)</div>
                            <div className="flex gap-2">
                                {[1, 2, 3].map((v) => (
                                    <div key={v} className={`flex-1 rounded-md border px-2 py-1.5 text-center text-xs font-medium ${nineBoxModal.desempenho === v ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                                        {v === 1 ? "Baixo" : v === 2 ? "Médio" : "Alto"}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mb-5">
                            <label className="text-xs font-medium text-muted-foreground block mb-2">
                                Potencial (sua avaliação): <span className="font-bold text-foreground">{nineBoxPotencial === 1 ? "Baixo" : nineBoxPotencial === 2 ? "Médio" : "Alto"}</span>
                            </label>
                            <input
                                type="range" min={1} max={3} step={1} value={nineBoxPotencial}
                                className="w-full accent-primary"
                                onChange={(e) => setNineBoxPotencial(Number(e.target.value))}
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                <span>Baixo</span><span>Médio</span><span>Alto</span>
                            </div>
                        </div>

                        <div className="rounded-lg px-3 py-2 text-center text-xs font-semibold bg-primary/10 text-primary mb-5">
                            Quadrante: {NINE_BOX_NAMES[`${nineBoxModal.desempenho}-${nineBoxPotencial}`] ?? "—"}
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setNineBoxModal(null)} disabled={savingNineBox}>Cancelar</Button>
                            <Button size="sm" className="flex-1" onClick={() => void salvarNineBox()} disabled={savingNineBox}>
                                {savingNineBox ? "Salvando..." : "Confirmar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
