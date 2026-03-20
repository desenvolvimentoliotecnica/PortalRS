"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Pencil, Trash2, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

/* ── Types ── */
interface MenuItem {
    id: string;
    displayName: string;
    route: string | null;
    icon: string | null;
    parentId: string | null;
    order: number;
    isActive: boolean;
    permissionKey: string | null;
    module: string | null;
}

interface MenuFormData {
    displayName: string;
    route: string;
    icon: string;
    order: number;
    parentId: string;
    permissionKey: string;
    isActive: boolean;
}

const EMPTY_FORM: MenuFormData = {
    displayName: "",
    route: "",
    icon: "",
    order: 0,
    parentId: "",
    permissionKey: "",
    isActive: true,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function AdminMenusScreen() {
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [moduleFilter, setModuleFilter] = useState("all");

    // Create/Edit form
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<MenuFormData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const loadMenus = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchJson<MenuItem[]>("/api/menus");
            setMenus(list);
        } catch (err) {
            console.error("Failed to load menus", err);
            toast.error("Falha ao carregar menus.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadMenus(); }, [loadMenus]);

    const modules = useMemo(() => [...new Set(menus.map(m => m.module).filter(Boolean))] as string[], [menus]);

    const filtered = useMemo(() => {
        let list = menus;
        if (q.trim()) {
            const lower = q.toLowerCase();
            list = list.filter(m => m.displayName.toLowerCase().includes(lower) || (m.route ?? "").toLowerCase().includes(lower) || (m.permissionKey ?? "").toLowerCase().includes(lower));
        }
        if (moduleFilter !== "all") list = list.filter(m => m.module === moduleFilter);
        return list.sort((a, b) => a.order - b.order);
    }, [menus, q, moduleFilter]);

    const parents = menus.filter(m => !m.parentId);

    function startCreate() {
        setEditId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    }

    function startEdit(menu: MenuItem) {
        setEditId(menu.id);
        setForm({
            displayName: menu.displayName,
            route: menu.route ?? "",
            icon: menu.icon ?? "",
            order: menu.order,
            parentId: menu.parentId ?? "",
            permissionKey: menu.permissionKey ?? "",
            isActive: menu.isActive,
        });
        setShowForm(true);
    }

    async function handleSave() {
        if (!form.displayName.trim()) { toast.error("Nome é obrigatório."); return; }
        if (!form.permissionKey.trim()) { toast.error("Chave de permissão é obrigatória."); return; }
        setSaving(true);
        try {
            const payload = {
                displayName: form.displayName.trim(),
                route: form.route.trim(),
                icon: form.icon.trim(),
                order: form.order,
                parentId: form.parentId || null,
                permissionKey: form.permissionKey.trim(),
                isActive: form.isActive,
            };
            if (editId) {
                await fetchJson(`/api/menus/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Menu atualizado!");
            } else {
                await fetchJson("/api/menus", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Menu criado!");
            }
            setShowForm(false);
            void loadMenus();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar menu.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string, name: string) {
        if (!(await confirmDialog({ title: "Remover menu", description: `Remover o menu "${name}"?`, confirmText: "Remover", destructive: true }))) return;
        try {
            await apiFetch(`/api/menus/${id}`, { method: "DELETE" });
            toast.success(`Menu "${name}" removido.`);
            void loadMenus();
        } catch {
            toast.error("Falha ao remover menu.");
        }
    }

    const upd = (key: keyof MenuFormData, value: string | number | boolean) =>
        setForm(prev => ({ ...prev, [key]: value }));

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Menus</h4>
                    <div className="text-muted-foreground text-sm">Gerencie a estrutura dos menus de navegação.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadMenus()} disabled={loading}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={startCreate}>
                        <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo menu</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total de Menus</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{menus.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Módulos</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">{modules.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Raízes</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{parents.length}</div>
                </div>
            </div>

            {showForm && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">{editId ? "Editar menu" : "Criar novo menu"}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                            <Input placeholder="Nome do menu" value={form.displayName} onChange={(e) => upd("displayName", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Rota</label>
                            <Input placeholder="/modulo/pagina" value={form.route} onChange={(e) => upd("route", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Ícone</label>
                            <Input placeholder="nome-do-icone" value={form.icon} onChange={(e) => upd("icon", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Chave de Permissão *</label>
                            <Input placeholder="modulo.acao" value={form.permissionKey} onChange={(e) => upd("permissionKey", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Menu Pai</label>
                            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.parentId} onChange={(e) => upd("parentId", e.target.value)}>
                                <option value="">Nenhum (raiz)</option>
                                {parents.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Ordem</label>
                            <Input type="number" value={form.order} onChange={(e) => upd("order", parseInt(e.target.value) || 0)} />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="menu-active" checked={form.isActive} onChange={(e) => upd("isActive", e.target.checked)} className="rounded border-input" />
                            <label htmlFor="menu-active" className="text-sm font-medium">Ativo</label>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                        <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                    </div>
                </div>
            )}

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Estrutura dos menus</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[200px] pl-8" placeholder="buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                            <option value="all">Todos módulos</option>
                            {modules.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Menu</TableHead>
                            <TableHead>Rota</TableHead>
                            <TableHead>Permissão</TableHead>
                            <TableHead>Módulo</TableHead>
                            <TableHead className="text-center">Ordem</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum menu encontrado.</TableCell></TableRow>
                        ) : (
                            filtered.map((m) => (
                                <TableRow key={m.id} className={m.parentId ? "bg-muted/20" : ""}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {m.parentId && <span className="text-muted-foreground">└</span>}
                                            <LayoutList className="size-4 text-primary" />
                                            {m.displayName}
                                        </div>
                                    </TableCell>
                                    <TableCell><code className="text-xs">{m.route || "—"}</code></TableCell>
                                    <TableCell><code className="text-xs">{m.permissionKey || "—"}</code></TableCell>
                                    <TableCell className="text-xs">{m.module || "—"}</TableCell>
                                    <TableCell className="text-center">{m.order}</TableCell>
                                    <TableCell className="text-center">
                                        {m.isActive
                                            ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Ativo</span>
                                            : <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">Inativo</span>
                                        }
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="outline" size="sm" onClick={() => startEdit(m)} title="Editar">
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => void handleDelete(m.id, m.displayName)} title="Remover">
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
        </section>
    );
}
