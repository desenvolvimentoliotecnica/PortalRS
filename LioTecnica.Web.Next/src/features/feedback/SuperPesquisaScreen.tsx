"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchCheck, RefreshCw, Plus, BarChart3, Users, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface SuperSurvey {
    id: string;
    title: string;
    description: string;
    status: string;
    totalQuestions: number;
    totalResponses: number;
    createdAtUtc: string;
    dueDate: string;
}

interface SurveyResult {
    questionText: string;
    averageScore: number | null;
    responseCount: number;
    topAnswer?: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    draft: { label: "Rascunho", cls: "text-gray-600 bg-gray-100" },
    active: { label: "Ativa", cls: "text-green-600 bg-green-100" },
    closed: { label: "Encerrada", cls: "text-red-600 bg-red-100" },
    completed: { label: "Concluída", cls: "text-blue-600 bg-blue-100" },
};

export default function SuperPesquisaScreen() {
    const [loading, setLoading] = useState(true);
    const [surveys, setSurveys] = useState<SuperSurvey[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [resultsSurveyId, setResultsSurveyId] = useState<string | null>(null);
    const [results, setResults] = useState<SurveyResult[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<SuperSurvey[]>("/api/feedback/surveys/super");
            setSurveys(data ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    const filtered = surveys.filter((s) => {
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        if (q.trim()) return s.title?.toLowerCase().includes(q.toLowerCase());
        return true;
    });

    function fmtDate(iso: string) {
        try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
    }

    async function viewResults(id: string) {
        setResultsSurveyId(id);
        try {
            const data = await fetchJson<SurveyResult[]>(`/api/feedback/surveys/super/${id}/results`);
            setResults(data ?? []);
        } catch {
            toast.error("Falha ao carregar resultados.");
            setResults([]);
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Super Pesquisa</h4>
                    <div className="text-muted-foreground text-sm">Crie e gerencie pesquisas avançadas de clima e engajamento.</div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => toast.info("Funcionalidade de criação em breve.")}>
                        <Plus className="size-4 mr-1" />Nova pesquisa
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                        <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{surveys.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ativas</div>
                    <div className="mt-1 text-2xl font-bold text-green-600">{surveys.filter(s => s.status === "active").length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Respostas</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">{surveys.reduce((acc, s) => acc + s.totalResponses, 0)}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Rascunhos</div>
                    <div className="mt-1 text-2xl font-bold text-muted-foreground">{surveys.filter(s => s.status === "draft").length}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <Input placeholder="Buscar pelo título..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                        {[
                            { key: "all", label: "Todas" },
                            { key: "active", label: "Ativas" },
                            { key: "closed", label: "Encerradas" },
                            { key: "draft", label: "Rascunhos" },
                        ].map((f) => (
                            <Button key={f.key} variant={statusFilter === f.key ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(f.key)}>
                                {f.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 backdrop-blur overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pesquisa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Perguntas</TableHead>
                            <TableHead className="text-center">Respostas</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                <SearchCheck className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                                Nenhuma pesquisa encontrada.
                            </TableCell></TableRow>
                        ) : filtered.map((s) => {
                            const cfg = STATUS_MAP[s.status] ?? STATUS_MAP.draft;
                            return (
                                <TableRow key={s.id}>
                                    <TableCell>
                                        <div className="font-medium">{s.title}</div>
                                        <div className="text-xs text-muted-foreground">{s.description}</div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                                            {cfg.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">{s.totalQuestions}</TableCell>
                                    <TableCell className="text-center font-semibold">{s.totalResponses}</TableCell>
                                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(s.dueDate)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void viewResults(s.id)}>
                                            <BarChart3 className="size-3.5 mr-1" />Resultados
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Results modal */}
            {resultsSurveyId && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="card-soft w-full max-w-2xl bg-white dark:bg-card shadow-2xl rounded-2xl overflow-hidden max-h-[80vh] overflow-y-auto">
                        <div className="p-5 border-b border-border/30 flex items-start justify-between gap-2">
                            <div>
                                <div className="font-bold text-lg">Resultados da Pesquisa</div>
                                <div className="text-sm text-muted-foreground">{surveys.find(s => s.id === resultsSurveyId)?.title}</div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setResultsSurveyId(null)}>Fechar</Button>
                        </div>
                        <div className="p-5 space-y-3">
                            {results.length === 0 ? (
                                <div className="text-center text-muted-foreground py-6">Nenhum resultado disponível.</div>
                            ) : results.map((r, i) => (
                                <div key={i} className="rounded-lg bg-muted/30 p-3">
                                    <div className="font-medium text-sm mb-1">{i + 1}. {r.questionText}</div>
                                    <div className="flex flex-wrap gap-3 text-xs">
                                        <span className="flex items-center gap-1"><Users className="size-3" /> {r.responseCount} respostas</span>
                                        {r.averageScore != null && (
                                            <span className="flex items-center gap-1"><BarChart3 className="size-3" /> Média: {r.averageScore.toFixed(1)}</span>
                                        )}
                                        {r.topAnswer && (
                                            <span className="text-muted-foreground">Mais escolhida: <strong>{r.topAnswer}</strong></span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
