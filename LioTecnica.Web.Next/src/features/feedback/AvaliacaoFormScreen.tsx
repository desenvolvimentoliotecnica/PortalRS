"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ────── types ────── */

interface PerguntaResponse { id: string; texto: string; ordem: number; }
interface CicloResponse {
    id: string; nome: string; periodo: string; status: number;
    perguntas: PerguntaResponse[];
}
interface FuncionarioOption { id: string; name: string; }

/* ────── nota selector ────── */

const NOTA_LABELS: Record<number, string> = {
    1: "Muito Abaixo", 2: "Abaixo", 3: "Dentro do Esperado", 4: "Acima", 5: "Muito Acima",
};

function NotaSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(n)}
                    className={`flex flex-col items-center rounded-lg border-2 px-3 py-2 transition-all min-w-[60px] ${value === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                >
                    <span className="text-lg font-bold">{n}</span>
                    <span className="text-[10px] text-center leading-tight">{NOTA_LABELS[n]}</span>
                </button>
            ))}
        </div>
    );
}

/* ────── main component ────── */

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

export default function AvaliacaoFormScreen({ cicloId }: { cicloId: string }) {
    const router = useRouter();
    const [ciclo, setCiclo] = useState<CicloResponse | null>(null);
    const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [avaliandoId, setAvaliandoId] = useState("");
    const [notas, setNotas] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [c, f] = await Promise.all([
                fetchJson<CicloResponse>(`/api/avaliacao/ciclos/${cicloId}`),
                fetchJson<any>("/api/funcionarios?pageSize=200"),
            ]);
            setCiclo(c);
            const items: any[] = Array.isArray(f) ? f : (f?.items ?? []);
            setFuncionarios(items.map((x) => ({ id: x.id, name: x.name ?? x.nome ?? "" })));
            if (items.length > 0) setAvaliandoId(items[0].id);
        } catch {
            toast.error("Falha ao carregar ciclo.");
        } finally {
            setLoading(false);
        }
    }, [cicloId]);

    useEffect(() => { void load(); }, [load]);

    const allAnswered = ciclo?.perguntas.every(p => notas[p.id] !== undefined) ?? false;

    async function submit() {
        if (!avaliandoId) { toast.error("Selecione o avaliando."); return; }
        if (!allAnswered) { toast.error("Responda todas as perguntas."); return; }
        setSubmitting(true);
        try {
            const respostas = ciclo!.perguntas.map(p => ({ perguntaId: p.id, nota: notas[p.id] }));
            await fetchJson(`/api/avaliacao/ciclos/${cicloId}/responder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avaliandoId, respostas }),
            });
            toast.success("Avaliação enviada com sucesso!");
            setDone(true);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return (
        <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
    );

    if (!ciclo) return (
        <div className="text-center py-12">
            <p className="text-muted-foreground">Ciclo não encontrado.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>Voltar</Button>
        </div>
    );

    if (ciclo.status === 1) return (
        <div className="max-w-2xl mx-auto text-center py-16">
            <p className="text-lg font-semibold">Este ciclo está fechado.</p>
            <p className="text-muted-foreground mt-1">Não é possível registrar mais respostas.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>Voltar</Button>
        </div>
    );

    if (done) return (
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
            <CheckCircle2 className="size-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Avaliação enviada!</h2>
            <p className="text-muted-foreground">Suas respostas foram registradas com sucesso.</p>
            <div className="flex items-center justify-center gap-3">
                <Button variant="outline" onClick={() => { setDone(false); setNotas({}); }}>Avaliar outro funcionário</Button>
                <Button onClick={() => router.back()}>Voltar aos ciclos</Button>
            </div>
        </div>
    );

    return (
        <section className="max-w-2xl mx-auto space-y-5">
            <div>
                <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.back()}>
                    <ArrowLeft className="size-4 mr-1" /> Voltar
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight">{ciclo.nome}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Período: {ciclo.periodo} · Escala 1 (Muito Abaixo) a 5 (Muito Acima)</p>
            </div>

            {/* Selecionar avaliando */}
            <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avaliando *</label>
                <select
                    className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={avaliandoId}
                    onChange={(e) => setAvaliandoId(e.target.value)}
                >
                    <option value="">Selecione o funcionário a avaliar...</option>
                    {funcionarios.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>
            </div>

            {/* Perguntas */}
            {ciclo.perguntas.map((p, idx) => (
                <div key={p.id} className="rounded-xl border border-border/40 bg-card p-4 shadow-sm space-y-3">
                    <div className="font-medium text-sm">
                        <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                        {p.texto}
                    </div>
                    <NotaSelector value={notas[p.id] ?? 0} onChange={(n) => setNotas(prev => ({ ...prev, [p.id]: n }))} />
                </div>
            ))}

            {/* Submit */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                    {Object.keys(notas).length} de {ciclo.perguntas.length} pergunta{ciclo.perguntas.length !== 1 ? "s" : ""} respondida{ciclo.perguntas.length !== 1 ? "s" : ""}
                </span>
                <Button onClick={() => void submit()} disabled={submitting || !allAnswered || !avaliandoId}>
                    <Send className="size-4 mr-2" />
                    {submitting ? "Enviando..." : "Enviar Avaliação"}
                </Button>
            </div>
        </section>
    );
}
