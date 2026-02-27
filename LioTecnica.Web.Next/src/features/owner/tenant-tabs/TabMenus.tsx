"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? (null as T) : res.json();
}

interface MenuItem {
    id: string;
    displayName: string;
    route: string;
    icon: string;
    order: number;
    parentId: string | null;
    permissionKey: string;
    isActive: boolean;
}

interface MenuForm {
    displayName: string;
    route: string;
    icon: string;
    order: number;
    parentId: string | null;
    permissionKey: string;
    isActive: boolean;
}

const emptyForm = (): MenuForm => ({
    displayName: "", route: "", icon: "", order: 0, parentId: null, permissionKey: "", isActive: true,
});

export default function TabMenus({ tenantId }: { tenantId: string }) {
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Config/Menus/_api`;

    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [editMenu, setEditMenu] = useState<MenuItem | null>(null);
    const [form, setForm] = useState<MenuForm>(emptyForm());
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<MenuItem[]>(`${apiBase}/list`);
            setMenus(data || []);
        } catch { toast.error("Erro ao carregar menus."); }
        finally { setLoading(false); }
    }, [apiBase]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => {
        setEditMenu(null);
        setForm(emptyForm());
        setEditOpen(true);
    };

    const openEdit = (menu: MenuItem) => {
        setEditMenu(menu);
        setForm({
            displayName: menu.displayName,
            route: menu.route,
            icon: menu.icon,
            order: menu.order,
            parentId: menu.parentId,
            permissionKey: menu.permissionKey,
            isActive: menu.isActive,
        });
        setEditOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editMenu) {
                await fetchJson(`${apiBase}/update/${editMenu.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                toast.success("Menu atualizado.");
            } else {
                await fetchJson(`${apiBase}/create`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                toast.success("Menu criado.");
            }
            setEditOpen(false);
            await load();
        } catch { toast.error("Falha ao salvar."); }
        finally { setSaving(false); }
    };

    // Build parent options (exclude current menu and its children)
    const parentOptions = menus.filter((m) => !editMenu || m.id !== editMenu.id);

    // Build hierarchy for display
    const topLevel = menus.filter((m) => !m.parentId);
    const children = menus.filter((m) => m.parentId);
    const childrenByParent = children.reduce<Record<string, MenuItem[]>>((acc, m) => {
        const key = m.parentId!;
        acc[key] = acc[key] || [];
        acc[key].push(m);
        return acc;
    }, {});

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

    const renderRow = (m: MenuItem, indent: number) => (
        <tr key={m.id} className="border-b hover:bg-muted/50 transition">
            <td className="py-2 px-3 font-medium" style={{ paddingLeft: `${12 + indent * 24}px` }}>
                {m.icon && <span className="mr-1.5">{m.icon}</span>}
                {m.displayName}
            </td>
            <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{m.route}</td>
            <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{m.permissionKey}</td>
            <td className="py-2 px-3 text-center text-xs">{m.order}</td>
            <td className="py-2 px-3 text-center">
                <span className={`inline-block w-2 h-2 rounded-full ${m.isActive ? "bg-green-500" : "bg-gray-300"}`} />
            </td>
            <td className="py-2 px-3 text-right">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(m)}>
                    <Edit className="size-3.5 mr-1" />Editar
                </Button>
            </td>
        </tr>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{menus.length} menus cadastrados</h3>
                <Button onClick={openNew} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                    <Plus className="size-4 mr-1.5" />Novo menu
                </Button>
            </div>

            <Card className="shadow-lt">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-2 px-3">Nome</th>
                            <th className="text-left py-2 px-3">Rota</th>
                            <th className="text-left py-2 px-3">Permissão</th>
                            <th className="text-center py-2 px-3">Ordem</th>
                            <th className="text-center py-2 px-3">Ativo</th>
                            <th className="py-2 px-3"></th>
                        </tr></thead>
                        <tbody>
                            {menus.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhum menu.</td></tr>
                            ) : (
                                <>
                                    {topLevel.sort((a, b) => a.order - b.order).map((m) => (
                                        <>
                                            {renderRow(m, 0)}
                                            {(childrenByParent[m.id] || []).sort((a, b) => a.order - b.order).map((c) => renderRow(c, 1))}
                                        </>
                                    ))}
                                    {/* Menus with parentId that doesn't match any top-level */}
                                    {children.filter((c) => !topLevel.some((t) => t.id === c.parentId)).map((c) => renderRow(c, 1))}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">{editMenu ? `Editar: ${editMenu.displayName}` : "Novo menu"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Nome de exibição *</label>
                            <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Rota *</label>
                            <Input value={form.route} onChange={(e) => setForm((f) => ({ ...f, route: e.target.value }))} placeholder="/Admin/Dashboard" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Ícone</label>
                                <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="bi bi-house" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Ordem</label>
                                <Input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))} />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Chave de permissão *</label>
                            <Input value={form.permissionKey} onChange={(e) => setForm((f) => ({ ...f, permissionKey: e.target.value }))} placeholder="dashboard.read" />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Menu pai</label>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={form.parentId || ""}
                                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value || null }))}
                            >
                                <option value="">— Nenhum (raiz) —</option>
                                {parentOptions.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="menuActive" className="rounded" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                            <label htmlFor="menuActive" className="text-sm font-medium">Ativo</label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                            {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                            {editMenu ? "Salvar" : "Criar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
