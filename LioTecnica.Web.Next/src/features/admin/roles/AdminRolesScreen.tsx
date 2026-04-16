"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Pencil, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import AdminRoleFormModal from "./AdminRoleFormModal";

/* ── Types ── */
interface RoleListItem {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    tipo: number;          // 0=RH Rec. e Seleção, 1=Colaborador, 2=Gestor, 3=Compliance, 4=Admin, 5=RH Admissão
    visibilityScope: number;
    vagasDataScope: number;
    accessMode: number;
    userCount: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

const TIPO_LABEL: Record<number, string> = { 0: "RH - Recrutamento e Seleção", 1: "Colaborador", 2: "Gestor", 3: "Compliance", 4: "Admin", 5: "RH - Admissão" };
const TIPO_COLOR: Record<number, string> = {
    0: "bg-violet-100 text-violet-800",
    1: "bg-sky-100 text-sky-800",
    2: "bg-amber-100 text-amber-800",
    3: "bg-teal-100 text-teal-800",
    4: "bg-red-100 text-red-800",
    5: "bg-purple-100 text-purple-800",
};

export default function AdminRolesScreen() {
    const [roles, setRoles] = useState<RoleListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [tipoFilter, setTipoFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const [modalOpen, setModalOpen] = useState(false);
    const [modalEditId, setModalEditId] = useState<string | null>(null);

    const loadRoles = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchJson<RoleListItem[]>("/api/roles");
            setRoles(list);
        } catch (err) {
            console.error("Failed to load roles", err);
            toast.error("Falha ao carregar perfis.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadRoles(); }, [loadRoles]);

    const filtered = useMemo(() => {
        let list = roles;
        if (q.trim()) {
            const lower = q.toLowerCase();
            list = list.filter(r => r.name.toLowerCase().includes(lower) || (r.description ?? "").toLowerCase().includes(lower));
        }
        if (tipoFilter !== "all") list = list.filter(r => String(r.tipo) === tipoFilter);
        if (statusFilter === "active") list = list.filter(r => r.isActive);
        if (statusFilter === "inactive") list = list.filter(r => !r.isActive);
        return list;
    }, [roles, q, tipoFilter, statusFilter]);

    async function handleDelete(id: string, name: string) {
        if (!(await confirmDialog({ title: "Remover perfil", description: `Remover o perfil "${name}"?`, confirmText: "Remover", destructive: true }))) return;
        try {
            await apiFetch(`/api/roles/${id}`, { method: "DELETE" });
            toast.success(`Perfil "${name}" removido.`);
            void loadRoles();
        } catch {
            toast.error("Falha ao remover perfil.");
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Perfis e Permissões</h4>
                    <div className="text-muted-foreground text-sm">Gerencie os perfis de acesso e suas permissões.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadRoles()} disabled={loading}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={() => { setModalEditId(null); setModalOpen(true); }}>
                        <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo perfil</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{roles.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">RH</div>
                    <div className="mt-1 text-2xl font-bold text-violet-600">{roles.filter(r => r.tipo === 0).length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Colaborador</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">{roles.filter(r => r.tipo === 1).length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Gestor</div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{roles.filter(r => r.tipo === 2).length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Compliance</div>
                    <div className="mt-1 text-2xl font-bold text-teal-600">{roles.filter(r => r.tipo === 3).length}</div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Lista de perfis</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[200px] pl-8" placeholder="buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
                            <option value="all">Todos os tipos</option>
                            <option value="0">RH</option>
                            <option value="1">Colaborador</option>
                            <option value="2">Gestor</option>
                            <option value="3">Compliance</option>
                            <option value="4">Admin</option>
                        </select>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="active">Ativos</option>
                            <option value="inactive">Inativos</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Perfil</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum perfil encontrado.</TableCell></TableRow>
                        ) : (
                            filtered.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2"><Shield className="size-4 text-primary" /> {r.name}</div>
                                            <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLOR[r.tipo] ?? "bg-zinc-100 text-zinc-600"}`}>
                                                {TIPO_LABEL[r.tipo] ?? "—"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.description || "—"}</TableCell>
                                    <TableCell className="text-center">
                                        {r.isActive
                                            ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Ativo</span>
                                            : <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">Inativo</span>
                                        }
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { setModalEditId(r.id); setModalOpen(true); }}
                                                title="Editar"
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => void handleDelete(r.id, r.name)} title="Remover">
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AdminRoleFormModal
                open={modalOpen}
                editId={modalEditId}
                onClose={() => setModalOpen(false)}
                onSaved={() => { setModalOpen(false); void loadRoles(); }}
            />
        </section>
    );
}
