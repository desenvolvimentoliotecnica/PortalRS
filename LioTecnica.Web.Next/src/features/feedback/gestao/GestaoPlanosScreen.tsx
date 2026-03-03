"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, RefreshCw, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
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

interface PDI {
    id: string;
    title: string;
    responsibleName: string;
    status: string;
    dueDate: string;
    progress: number;
    createdAtUtc: string;
}

const STATUS_MAP: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
    in_progress: { label: "Em andamento", icon: Clock, cls: "text-blue-600 bg-blue-100" },
    completed: { label: "Concluído", icon: CheckCircle2, cls: "text-green-600 bg-green-100" },
    overdue: { label: "Atrasado", icon: AlertTriangle, cls: "text-red-600 bg-red-100" },
    pending: { label: "Pendente", icon: Clock, cls: "text-amber-600 bg-amber-100" },
};

export default function GestaoPlanosScreen() {
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<PDI[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<PDI[]>("/api/gestao/planos");
            setPlans(data ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    const filtered = plans.filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (q.trim()) {
            const lower = q.toLowerCase();
            return p.title?.toLowerCase().includes(lower) || p.responsibleName?.toLowerCase().includes(lower);
        }
        return true;
    });

    function fmtDate(iso: string) {
        try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
    }

    function getStatusBadge(status: string) {
        const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending;
        const Icon = cfg.icon;
        return (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                <Icon className="size-3" />{cfg.label}
            </span>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Planos de Desenvolvimento Individual</h4>
                    <div className="text-muted-foreground text-sm">Crie e acompanhe PDIs para os membros da equipe.</div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => toast.info("Funcionalidade de criação de PDI em breve.")}>
                        <Plus className="size-4 mr-1" />Novo PDI
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                        <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total PDIs</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{plans.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Em andamento</div>
                    <div className="mt-1 text-2xl font-bold text-blue-600">{plans.filter(p => p.status === "in_progress").length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Concluídos</div>
                    <div className="mt-1 text-2xl font-bold text-green-600">{plans.filter(p => p.status === "completed").length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Atrasados</div>
                    <div className="mt-1 text-2xl font-bold text-red-600">{plans.filter(p => p.status === "overdue").length}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <Input placeholder="Buscar por título ou responsável..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                        {[
                            { key: "all", label: "Todos" },
                            { key: "in_progress", label: "Em andamento" },
                            { key: "completed", label: "Concluídos" },
                            { key: "overdue", label: "Atrasados" },
                        ].map((f) => (
                            <Button
                                key={f.key}
                                variant={statusFilter === f.key ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(f.key)}
                            >
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
                            <TableHead>Título</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Progresso</TableHead>
                            <TableHead>Prazo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                <BookOpen className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                                Nenhum plano encontrado.
                            </TableCell></TableRow>
                        ) : filtered.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.title}</TableCell>
                                <TableCell>{p.responsibleName}</TableCell>
                                <TableCell>{getStatusBadge(p.status)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                        <div className="h-2 flex-1 rounded-full bg-black/10 overflow-hidden">
                                            <div className="h-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
                                        </div>
                                        <span className="text-xs font-semibold w-8 text-right">{p.progress}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm whitespace-nowrap">{fmtDate(p.dueDate)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
