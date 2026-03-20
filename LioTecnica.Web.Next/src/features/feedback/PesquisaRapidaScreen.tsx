"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface QuickSurvey {
    id: string;
    title: string;
    description: string;
    status: string;
    totalQuestions: number;
    answeredQuestions: number;
    dueDate: string;
}

interface SurveyQuestion {
    id: string;
    text: string;
    type: string;
    options?: string[];
}

export default function PesquisaRapidaScreen() {
    const [loading, setLoading] = useState(true);
    const [surveys, setSurveys] = useState<QuickSurvey[]>([]);
    const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<QuickSurvey[]>("/api/feedback/surveys/quick");
            setSurveys(data ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    async function openSurvey(id: string) {
        setActiveSurveyId(id);
        try {
            const qs = await fetchJson<SurveyQuestion[]>(`/api/feedback/surveys/quick/${id}/questions`);
            setQuestions(qs ?? []);
            setAnswers({});
        } catch {
            toast.error("Falha ao carregar perguntas.");
        }
    }

    async function submitSurvey() {
        if (!activeSurveyId) return;
        setSubmitting(true);
        try {
            await fetchJson(`/api/feedback/surveys/quick/${activeSurveyId}/answers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers }),
            });
            toast.success("Pesquisa respondida com sucesso! 🎉");
            setActiveSurveyId(null);
            setQuestions([]);
            setAnswers({});
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao enviar respostas.");
        } finally { setSubmitting(false); }
    }

    function fmtDate(iso: string) {
        try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Pesquisa Rápida</h4>
                    <div className="text-muted-foreground text-sm">Responda pesquisas rápidas sobre clima organizacional e engajamento.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Disponíveis</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{surveys.filter(s => s.status === "pending").length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Respondidas</div>
                    <div className="mt-1 text-2xl font-bold text-green-600">{surveys.filter(s => s.status === "completed").length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-muted-foreground">{surveys.length}</div>
                </div>
            </div>

            {/* Survey list */}
            {loading ? (
                <div className="text-center text-muted-foreground py-8">Carregando pesquisas...</div>
            ) : surveys.length === 0 ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-12 backdrop-blur text-center">
                    <Search className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                    <div className="text-lg font-semibold text-muted-foreground">Nenhuma pesquisa disponível</div>
                    <div className="text-sm text-muted-foreground/70 mt-1">Quando houver pesquisas rápidas, elas aparecerão aqui.</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {surveys.map((s) => (
                        <div
                            key={s.id}
                            className={`card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur transition-all
                                ${s.status === "pending" ? "hover:border-primary/30 cursor-pointer" : "opacity-80"}`}
                            onClick={() => s.status === "pending" && void openSurvey(s.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {s.status === "completed" ? (
                                        <CheckCircle2 className="size-5 text-green-500 shrink-0" />
                                    ) : (
                                        <Clock className="size-5 text-amber-500 shrink-0" />
                                    )}
                                    <div>
                                        <div className="font-semibold text-sm">{s.title}</div>
                                        <div className="text-xs text-muted-foreground">{s.description}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground">Prazo: {fmtDate(s.dueDate)}</div>
                                    <div className="text-xs">
                                        {s.answeredQuestions}/{s.totalQuestions} perguntas
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Survey modal */}
            {activeSurveyId && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="card-soft w-full max-w-lg bg-white dark:bg-card shadow-2xl rounded-2xl overflow-hidden max-h-[80vh] overflow-y-auto">
                        <div className="p-5 border-b border-border/30">
                            <div className="flex items-start justify-between gap-2">
                                <div className="font-bold text-lg">Responder Pesquisa</div>
                                <Button variant="outline" size="sm" onClick={() => { setActiveSurveyId(null); setQuestions([]); }}>Fechar</Button>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            {questions.length === 0 ? (
                                <div className="text-center text-muted-foreground py-4">Carregando perguntas...</div>
                            ) : questions.map((q, i) => (
                                <div key={q.id} className="space-y-2">
                                    <div className="font-medium text-sm">{i + 1}. {q.text}</div>
                                    {q.type === "scale" ? (
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map((n) => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    className={`size-10 rounded-lg border-2 font-bold text-sm transition-all ${answers[q.id] === String(n) ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
                                                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: String(n) }))}
                                                >{n}</button>
                                            ))}
                                        </div>
                                    ) : q.options ? (
                                        <div className="space-y-1">
                                            {q.options.map((opt) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    className={`w-full text-left rounded-lg px-3 py-2 text-sm border transition-all ${answers[q.id] === opt ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50"}`}
                                                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                                >{opt}</button>
                                            ))}
                                        </div>
                                    ) : (
                                        <textarea
                                            className="w-full rounded-lg border border-input bg-background p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            rows={2}
                                            value={answers[q.id] ?? ""}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                            placeholder="Sua resposta..."
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-5 border-t border-border/30 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setActiveSurveyId(null); setQuestions([]); }}>Cancelar</Button>
                            <Button onClick={() => void submitSurvey()} disabled={submitting}>
                                {submitting ? "Enviando..." : "Enviar respostas"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
