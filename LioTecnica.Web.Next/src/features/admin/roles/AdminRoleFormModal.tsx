"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

/* ── Types ── */

interface RoleDraft {
    name: string;
    description: string;
    isActive: boolean;
    tipo: string;
    visibilityScope: string;
    vagasDataScope: string;
    accessMode: string;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

/* ── Helpers ── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

const emptyDraft: RoleDraft = {
    name: "",
    description: "",
    isActive: true,
    tipo: "Colaborador",
    visibilityScope: "FullStructure",
    vagasDataScope: "All",
    accessMode: "Full",
};

/* ── Section divider ── */
function Section({ title }: { title: string }) {
    return (
        <div className="col-span-full">
            <div className="flex items-center gap-2 my-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
                <div className="flex-1 border-t border-border" />
            </div>
        </div>
    );
}

/* ── Component ── */

export default function AdminRoleFormModal({ open, editId, onClose, onSaved }: Props) {
    const [draft, setDraft] = useState<RoleDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);

    useEffect(() => {
        if (!open) return;

        if (editId) {
            setLoadingEdit(true);
            type RoleDetail = {
                name: string;
                description: string;
                isActive: boolean;
                tipo: string;
                visibilityScope: string;
                vagasDataScope: string;
                accessMode: string;
            };
            fetchJson<RoleDetail>(`/api/roles/${editId}`)
                .then((r) => {
                    setDraft({
                        name: r.name,
                        description: r.description ?? "",
                        isActive: r.isActive,
                        tipo: r.tipo ?? "Colaborador",
                        visibilityScope: r.visibilityScope ?? "FullStructure",
                        vagasDataScope: r.vagasDataScope ?? "All",
                        accessMode: r.accessMode ?? "Full",
                    });
                })
                .catch(() => toast.error("Falha ao carregar dados do perfil."))
                .finally(() => setLoadingEdit(false));
        } else {
            setDraft({ ...emptyDraft });
        }
    }, [open, editId]);

    async function save() {
        if (!draft.name.trim()) {
            toast.error("Nome é obrigatório.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: draft.name.trim(),
                description: draft.description.trim() || null,
                isActive: draft.isActive,
                tipo: draft.tipo,
                visibilityScope: draft.visibilityScope,
                vagasDataScope: draft.vagasDataScope,
                accessMode: draft.accessMode,
            };

            if (editId) {
                await fetchJson(`/api/roles/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Perfil atualizado!");
            } else {
                await fetchJson("/api/roles", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Perfil criado!");
            }
            onSaved();
        } catch (e) {
            const raw = e instanceof Error ? e.message : "erro";
            toast.error(`Falha ao salvar: ${raw}`);
        } finally {
            setSaving(false);
        }
    }

    const L = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1";
    const S = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {editId ? "Editar Perfil" : "Novo Perfil"}
                    </DialogTitle>
                </DialogHeader>

                {loadingEdit ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <Section title="Identificação" />

                        <div className="col-span-2">
                            <label className={L}>Nome *</label>
                            <Input
                                value={draft.name}
                                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                                placeholder="Nome do perfil"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className={L}>Descrição</label>
                            <Input
                                value={draft.description}
                                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                placeholder="Descrição (opcional)"
                            />
                        </div>

                        <div>
                            <label className={L}>Tipo *</label>
                            <select
                                className={S}
                                value={draft.tipo}
                                onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))}
                            >
                                <option value="RH">RH</option>
                                <option value="Colaborador">Colaborador</option>
                                <option value="Gestor">Gestor</option>
                                <option value="Compliance">Compliance</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>

                        <div>
                            <label className={L}>Status</label>
                            <select
                                className={S}
                                value={draft.isActive ? "true" : "false"}
                                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "true" }))}
                            >
                                <option value="true">Ativo</option>
                                <option value="false">Inativo</option>
                            </select>
                        </div>

                        <Section title="Configurações de Acesso" />

                        <div>
                            <label className={L}>Escopo de Visibilidade</label>
                            <select
                                className={S}
                                value={draft.visibilityScope}
                                onChange={(e) => setDraft((d) => ({ ...d, visibilityScope: e.target.value }))}
                            >
                                <option value="FullStructure">Estrutura completa</option>
                                <option value="RestrictedByAreaOrRecruiter">Restrito por Área/Recrutador</option>
                            </select>
                        </div>

                        <div>
                            <label className={L}>Escopo de Vagas</label>
                            <select
                                className={S}
                                value={draft.vagasDataScope}
                                onChange={(e) => setDraft((d) => ({ ...d, vagasDataScope: e.target.value }))}
                            >
                                <option value="All">Todas</option>
                                <option value="ByArea">Por Área</option>
                                <option value="ByRecrutador">Apenas do Recrutador</option>
                            </select>
                        </div>

                        <div>
                            <label className={L}>Modo de Acesso</label>
                            <select
                                className={S}
                                value={draft.accessMode}
                                onChange={(e) => setDraft((d) => ({ ...d, accessMode: e.target.value }))}
                            >
                                <option value="Full">Completo</option>
                                <option value="ReadOnly">Somente Leitura</option>
                            </select>
                        </div>
                    </div>
                )}

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void save()} disabled={saving || loadingEdit}>
                        {saving ? "Salvando…" : editId ? "Salvar alterações" : "Criar perfil"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
