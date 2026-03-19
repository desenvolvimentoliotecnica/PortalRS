"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

/* ── Types ── */

interface RegraAprovacaoVaga {
    id: string;
    solicitanteRoleId: string | null;
    solicitanteRoleNome: string | null;
    aprovador1FuncionarioId: string;
    aprovador1Nome: string | null;
    aprovador2FuncionarioId: string | null;
    aprovador2Nome: string | null;
    aprovador2Habilitado: boolean;
    ativo: boolean;
}

interface RoleOption { id: string; name: string; }
interface FuncionarioOption { id: string; name: string; }

/* ── Helpers ── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null as T;
    return res.json();
}

/* ── Component ── */

export default function RegrasAprovacaoVagaScreen() {
    const [regras, setRegras] = useState<RegraAprovacaoVaga[]>([]);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({
        solicitanteRoleId: "",
        aprovador1FuncionarioId: "",
        aprovador2FuncionarioId: "",
        aprovador2Habilitado: false,
        ativo: true,
    });
    const [saving, setSaving] = useState(false);

    const loadRegras = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<RegraAprovacaoVaga[]>("/api/regras-aprovacao-vaga");
            setRegras(data ?? []);
        } catch {
            toast.error("Falha ao carregar regras de aprovação.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRegras();
        fetchJson<RoleOption[]>("/api/roles").then(setRoles).catch(() => {});
        fetchJson<any>("/api/funcionarios?pageSize=200").then(
            (res) => setFuncionarios(res?.items ?? res ?? [])
        ).catch(() => {});
    }, [loadRegras]);

    function openCreate() {
        setEditId(null);
        setForm({ solicitanteRoleId: "", aprovador1FuncionarioId: "", aprovador2FuncionarioId: "", aprovador2Habilitado: false, ativo: true });
        setShowForm(true);
    }

    function openEdit(r: RegraAprovacaoVaga) {
        setEditId(r.id);
        setForm({
            solicitanteRoleId: r.solicitanteRoleId ?? "",
            aprovador1FuncionarioId: r.aprovador1FuncionarioId,
            aprovador2FuncionarioId: r.aprovador2FuncionarioId ?? "",
            aprovador2Habilitado: r.aprovador2Habilitado,
            ativo: r.ativo,
        });
        setShowForm(true);
    }

    async function handleSave() {
        if (!form.aprovador1FuncionarioId) { toast.error("Selecione o Aprovador 1."); return; }
        setSaving(true);
        try {
            const payload = {
                solicitanteRoleId: form.solicitanteRoleId || null,
                aprovador1FuncionarioId: form.aprovador1FuncionarioId,
                aprovador2FuncionarioId: form.aprovador2FuncionarioId || null,
                aprovador2Habilitado: form.aprovador2Habilitado,
                ativo: form.ativo,
            };

            if (editId) {
                await fetchJson(`/api/regras-aprovacao-vaga/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Regra atualizada.");
            } else {
                await fetchJson("/api/regras-aprovacao-vaga", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Regra criada.");
            }
            setShowForm(false);
            void loadRegras();
        } catch (err: any) {
            toast.error(err.message || "Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!(await confirmDialog("Excluir esta regra de aprovação?"))) return;
        try {
            await apiFetch(`/api/regras-aprovacao-vaga/${id}`, { method: "DELETE" });
            toast.success("Regra excluída.");
            void loadRegras();
        } catch {
            toast.error("Falha ao excluir.");
        }
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Regras de Aprovação de Vaga</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Define quem aprova solicitações de abertura de vaga por perfil do solicitante.
                        A regra <strong>Padrão</strong> é usada quando nenhuma regra específica se aplica.
                        Se nenhuma regra existir, o sistema usa o gestor direto do solicitante.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadRegras}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-1" /> Nova Regra
                    </Button>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Perfil do Solicitante</TableHead>
                        <TableHead>Aprovador 1</TableHead>
                        <TableHead>Aprovador 2</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                Carregando...
                            </TableCell>
                        </TableRow>
                    ) : regras.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                Nenhuma regra configurada. O sistema usará o gestor direto do solicitante.
                            </TableCell>
                        </TableRow>
                    ) : (
                        regras.map((r) => (
                            <TableRow key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                                <TableCell>
                                    {r.solicitanteRoleNome
                                        ? <span className="font-medium">{r.solicitanteRoleNome}</span>
                                        : <span className="text-muted-foreground italic">Padrão (todos os perfis)</span>
                                    }
                                </TableCell>
                                <TableCell>{r.aprovador1Nome ?? "—"}</TableCell>
                                <TableCell>
                                    {r.aprovador2Habilitado
                                        ? (r.aprovador2Nome ?? <span className="text-muted-foreground">Não definido</span>)
                                        : <span className="text-muted-foreground text-xs">Não requerido</span>
                                    }
                                </TableCell>
                                <TableCell>
                                    <span className={r.ativo ? "text-green-600 text-sm" : "text-muted-foreground text-sm"}>
                                        {r.ativo ? "Ativa" : "Inativa"}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {showForm && (
                <div className="border rounded-lg p-5 space-y-4 bg-muted/10">
                    <h2 className="font-semibold text-base">{editId ? "Editar Regra" : "Nova Regra"}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {!editId && (
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Perfil do Solicitante</label>
                                <select
                                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                                    value={form.solicitanteRoleId}
                                    onChange={(e) => setForm((f) => ({ ...f, solicitanteRoleId: e.target.value }))}
                                >
                                    <option value="">Padrão (todos os perfis)</option>
                                    {roles.map((r) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Aprovador 1 *</label>
                            <select
                                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                                value={form.aprovador1FuncionarioId}
                                onChange={(e) => setForm((f) => ({ ...f, aprovador1FuncionarioId: e.target.value }))}
                            >
                                <option value="">Selecione...</option>
                                {funcionarios.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 col-span-full">
                            <input
                                type="checkbox"
                                id="aprov2hab"
                                checked={form.aprovador2Habilitado}
                                onChange={(e) => setForm((f) => ({ ...f, aprovador2Habilitado: e.target.checked }))}
                                className="h-4 w-4"
                            />
                            <label htmlFor="aprov2hab" className="text-sm font-medium">Requer 2ª aprovação</label>
                        </div>

                        {form.aprovador2Habilitado && (
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Aprovador 2</label>
                                <select
                                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                                    value={form.aprovador2FuncionarioId}
                                    onChange={(e) => setForm((f) => ({ ...f, aprovador2FuncionarioId: e.target.value }))}
                                >
                                    <option value="">Selecione...</option>
                                    {funcionarios.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {editId && (
                            <div className="flex items-center gap-2 col-span-full">
                                <input
                                    type="checkbox"
                                    id="ativo"
                                    checked={form.ativo}
                                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                                    className="h-4 w-4"
                                />
                                <label htmlFor="ativo" className="text-sm font-medium">Regra ativa</label>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
