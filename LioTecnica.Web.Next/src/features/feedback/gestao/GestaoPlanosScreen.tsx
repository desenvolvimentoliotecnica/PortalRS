"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, RefreshCw, CheckCircle2, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.status === 204) return null as T;
    return res.json();
}

interface UserOption { userId: string; fullName: string; }

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

    // Modal Novo/Editar PDI
    const [modalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formTitle, setFormTitle] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formTargetUserId, setFormTargetUserId] = useState("");
    const [formGoals, setFormGoals] = useState<string[]>([""]);
    const [saving, setSaving] = useState(false);

    // Lista de funcionários (apenas ATIVOS — buscado pelo endpoint mention-users)
    const [users, setUsers] = useState<UserOption[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<PDI[]>("/api/gestao/planos");
            setPlans(data ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    const loadUsers = useCallback(async () => {
        try {
            const data = await fetchJson<UserOption[]>("/api/feedback/celebrations/mention-users?take=500");
            setUsers(data ?? []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { void loadData(); void loadUsers(); }, [loadData, loadUsers]);

    function openCreate() {
        setEditId(null);
        setFormTitle("");
        setFormDescription("");
        setFormTargetUserId("");
        setFormGoals([""]);
        setModalOpen(true);
    }

    async function handleSave() {
        if (!formTitle.trim()) { toast.error("Informe o título do PDI."); return; }
        setSaving(true);
        try {
            const planRes = await fetchJson<{ id: string }>("/api/feedback/plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: formTitle.trim(),
                    description: formDescription.trim() || null,
                    targetUserId: formTargetUserId || null,
                }),
            });

            // Adiciona metas (goals) ao plano recém-criado
            const validGoals = formGoals.filter(g => g.trim());
            for (let i = 0; i < validGoals.length; i++) {
                await apiFetch(`/api/feedback/plans/${planRes.id}/goals`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        description: validGoals[i].trim(),
                        dueDate: null,
                        order: i + 1,
                    }),
                });
            }

            toast.success(`PDI criado com ${validGoals.length} meta${validGoals.length !== 1 ? "s" : ""}.`);
            setModalOpen(false);
            void loadData();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao salvar PDI.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(planId: string, title: string) {
        if (!confirm(`Excluir o PDI "${title}"? Essa ação não pode ser desfeita.`)) return;
        try {
            await apiFetch(`/api/feedback/plans/${planId}`, { method: "DELETE" });
            toast.success("PDI excluído.");
            void loadData();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
        }
    }

    function updateGoal(idx: number, val: string) {
        const next = [...formGoals];
        next[idx] = val;
        setFormGoals(next);
    }

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
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="size-4 mr-1" />Novo PDI
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
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
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void handleDelete(p.id, p.title)}
                                        title="Excluir PDI"
                                    >
                                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Modal Novo/Editar PDI */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editId ? "Editar PDI" : "Novo PDI"}</DialogTitle>
                        <DialogDescription>
                            Plano de Desenvolvimento Individual com metas. O responsável pode ser você ou outro colaborador.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título *</label>
                            <Input
                                placeholder="Ex: Desenvolver liderança técnica em 2026"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                maxLength={200}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Para quem (opcional)</label>
                            <select
                                value={formTargetUserId}
                                onChange={(e) => setFormTargetUserId(e.target.value)}
                                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">— Meu próprio PDI —</option>
                                {users.map(u => (
                                    <option key={u.userId} value={u.userId}>{u.fullName}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Apenas funcionários ativos. Se vazio, o PDI é seu.
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição (opcional)</label>
                            <textarea
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                rows={3}
                                placeholder="Contexto, objetivos gerais..."
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                maxLength={2000}
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Metas</label>
                                <Button variant="ghost" size="sm" onClick={() => setFormGoals([...formGoals, ""])}>
                                    <Plus className="size-3.5 mr-1" /> Adicionar
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {formGoals.map((g, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <span className="text-xs text-muted-foreground pt-2.5 w-5 text-right shrink-0">{idx + 1}.</span>
                                        <Input
                                            placeholder={`Ex: Concluir curso de Power BI até 30/06`}
                                            value={g}
                                            onChange={(e) => updateGoal(idx, e.target.value)}
                                            maxLength={500}
                                        />
                                        {formGoals.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setFormGoals(formGoals.filter((_, i) => i !== idx))}
                                                title="Remover meta"
                                            >
                                                <Trash2 className="size-3.5 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={() => void handleSave()} disabled={saving || !formTitle.trim()}>
                            {saving ? "Salvando..." : editId ? "Salvar" : "Criar PDI"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
