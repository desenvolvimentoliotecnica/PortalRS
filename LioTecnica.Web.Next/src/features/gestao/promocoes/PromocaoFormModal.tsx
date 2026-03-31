"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

/* ──────────────────────────── types ──────────────────────────── */

interface LookupItem {
    id: string;
    name: string;
}

interface PromocaoDraft {
    funcionarioId: string | null;
    dataEfetiva: string;
    novoCargoId: string | null;
    novaAreaId: string | null;
    justificativa: string;
    observacoes: string;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

/* ──────────────────────────── helpers ──────────────────────────── */

const API = "/api/solicitacoes-promocao";

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

const emptyDraft: PromocaoDraft = {
    funcionarioId: null,
    dataEfetiva: "",
    novoCargoId: null,
    novaAreaId: null,
    justificativa: "",
    observacoes: "",
};

/* ──────────────────────────── component ──────────────────────────── */

export default function PromocaoFormModal({ open, editId, onClose, onSaved }: Props) {
    const [draft, setDraft] = useState<PromocaoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);

    /* ── lookups ── */
    const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);
    const [cargos, setCargos] = useState<LookupItem[]>([]);
    const [areas, setAreas] = useState<LookupItem[]>([]);

    const loadLookups = useCallback(async () => {
        const [funcsRes, cargosRes, areasRes] = await Promise.all([
            fetchJson<Record<string, unknown>>("/api/lookup/funcionarios?pageSize=200").catch(() => ({ items: [] })),
            fetchJson<LookupItem[]>("/api/lookup/job-positions").catch(() => []),
            fetchJson<LookupItem[]>("/api/lookup/areas").catch(() => []),
        ]);
        const funcItems = Array.isArray(funcsRes)
            ? funcsRes
            : Array.isArray((funcsRes as Record<string, unknown>)?.items)
                ? ((funcsRes as Record<string, unknown>).items as { id: string; nome: string }[]).map((f) => ({ id: f.id, name: f.nome }))
                : [];
        setFuncionarios(funcItems as LookupItem[]);
        setCargos(Array.isArray(cargosRes) ? cargosRes : []);
        setAreas(Array.isArray(areasRes) ? areasRes : []);
    }, []);

    useEffect(() => {
        if (!open) return;
        loadLookups();

        if (editId) {
            setLoadingEdit(true);
            fetchJson<Record<string, unknown>>(`${API}/${editId}`)
                .then((d) => {
                    setDraft({
                        funcionarioId: d?.funcionarioId ? String(d.funcionarioId) : null,
                        dataEfetiva: d?.dataEfetiva ? String(d.dataEfetiva).slice(0, 10) : "",
                        novoCargoId: d?.novoCargoId ? String(d.novoCargoId) : null,
                        novaAreaId: d?.novaAreaId ? String(d.novaAreaId) : null,
                        justificativa: String(d?.justificativa ?? ""),
                        observacoes: String(d?.observacoes ?? ""),
                    });
                })
                .catch(() => toast.error("Falha ao carregar solicitação."))
                .finally(() => setLoadingEdit(false));
        } else {
            setDraft({ ...emptyDraft });
        }
    }, [open, editId, loadLookups]);

    async function save() {
        if (!draft.funcionarioId) {
            toast.error("O funcionário é obrigatório.");
            return;
        }
        if (!draft.dataEfetiva) {
            toast.error("A data efetiva é obrigatória.");
            return;
        }
        if (!draft.novoCargoId) {
            toast.error("O novo cargo é obrigatório.");
            return;
        }
        if (!draft.justificativa.trim()) {
            toast.error("A justificativa é obrigatória.");
            return;
        }
        setSaving(true);
        const payload = {
            funcionarioId: draft.funcionarioId,
            dataEfetiva: draft.dataEfetiva,
            novoCargoId: draft.novoCargoId,
            novaAreaId: draft.novaAreaId || null,
            justificativa: draft.justificativa.trim(),
            observacoes: draft.observacoes.trim() || null,
        };

        try {
            if (editId) {
                await fetchJson(`${API}/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Solicitação atualizada.");
            } else {
                await fetchJson(API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Solicitação criada.");
            }
            onSaved();
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    const labelClass = "text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1";
    const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editId ? "Editar Promoção" : "Nova Solicitação de Promoção"}</DialogTitle>
                    <DialogDescription>
                        {editId ? "Atualize os dados da solicitação de promoção." : "Preencha os dados para solicitar uma promoção."}
                    </DialogDescription>
                </DialogHeader>

                {loadingEdit ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Funcionário */}
                        <div>
                            <label className={labelClass}>Funcionário *</label>
                            <select
                                className={selectClass}
                                value={draft.funcionarioId ?? ""}
                                onChange={(e) => setDraft((d) => ({ ...d, funcionarioId: e.target.value || null }))}
                            >
                                <option value="">Selecione o funcionário...</option>
                                {funcionarios.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Data Efetiva */}
                        <div>
                            <label className={labelClass}>Data Efetiva *</label>
                            <Input
                                type="date"
                                value={draft.dataEfetiva}
                                onChange={(e) => setDraft((d) => ({ ...d, dataEfetiva: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Novo Cargo */}
                            <div>
                                <label className={labelClass}>Novo Cargo *</label>
                                <select
                                    className={selectClass}
                                    value={draft.novoCargoId ?? ""}
                                    onChange={(e) => setDraft((d) => ({ ...d, novoCargoId: e.target.value || null }))}
                                >
                                    <option value="">Selecione o cargo...</option>
                                    {cargos.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Nova Área */}
                            <div>
                                <label className={labelClass}>Nova Área</label>
                                <select
                                    className={selectClass}
                                    value={draft.novaAreaId ?? ""}
                                    onChange={(e) => setDraft((d) => ({ ...d, novaAreaId: e.target.value || null }))}
                                >
                                    <option value="">Sem alteração de área</option>
                                    {areas.map((a) => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Justificativa */}
                        <div>
                            <label className={labelClass}>Justificativa *</label>
                            <textarea
                                className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                rows={3}
                                value={draft.justificativa}
                                onChange={(e) => setDraft((d) => ({ ...d, justificativa: e.target.value }))}
                                placeholder="Justifique a promoção do funcionário..."
                                maxLength={2000}
                            />
                        </div>

                        {/* Observações */}
                        <div>
                            <label className={labelClass}>Observações</label>
                            <textarea
                                className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                rows={2}
                                value={draft.observacoes}
                                onChange={(e) => setDraft((d) => ({ ...d, observacoes: e.target.value }))}
                                placeholder="Observações adicionais (opcional)..."
                                maxLength={1000}
                            />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void save()} disabled={saving || loadingEdit}>
                        {saving ? "Salvando…" : editId ? "Salvar" : "Criar solicitação"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
