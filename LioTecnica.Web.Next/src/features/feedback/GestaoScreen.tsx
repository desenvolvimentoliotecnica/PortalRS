"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Users, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface TeamPlan {
    id: string;
    userName: string | null;
    title: string | null;
    status: string | null;
    progress: number;
    dueDate: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

export default function GestaoScreen() {
    const [plans, setPlans] = useState<TeamPlan[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try { setPlans(await fetchJson<TeamPlan[]>("/api/feedback/plans/team")); }
        catch { /* may have no data */ setPlans([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Gestão da Equipe</h4>
                    <div className="text-muted-foreground text-sm">Acompanhe os planos de desenvolvimento da sua equipe.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total de Planos</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{plans.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Concluídos</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{plans.filter(p => p.status === "completed").length}</div>
                </div>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Progresso</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : plans.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum plano da equipe encontrado.</TableCell></TableRow>
                                : plans.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium"><div className="flex items-center gap-2"><Users className="size-4 text-primary" />{p.userName || "—"}</div></TableCell>
                                        <TableCell className="text-sm">{p.title || "—"}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "completed" ? "bg-emerald-100 text-emerald-800" : p.status === "in_progress" ? "bg-sky-100 text-sky-800" : "bg-zinc-100 text-zinc-600"}`}>
                                                {p.status === "completed" ? "Concluído" : p.status === "in_progress" ? "Em andamento" : p.status || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center gap-2"><div className="flex-1 bg-muted rounded-full h-2"><div className="bg-primary rounded-full h-2" style={{ width: `${p.progress}%` }} /></div><span className="text-xs text-muted-foreground">{p.progress}%</span></div>
                                        </TableCell>
                                        <TableCell className="text-xs">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
