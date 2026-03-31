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

interface DesligamentoDraft {
    funcionarioId: string | null;
    dataDesligamento: string;
    tipoDesligamento: number;
    motivoDesligamento: string;
    tipoAvisoPrevio: number;
    diasAvisoPrevio: number;
    elegivelRecontratacao: boolean;
    substituirPosicao: boolean;
    observacoes: string;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

/* ──────────────────────────── helpers ──────────────────────────── */

const API = "/api/solicitacoes-desligamento";

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

const emptyDraft: DesligamentoDraft = {
    funcionarioId: null,
    dataDesligamento: "",
    tipoDesligamento: 0,
    motivoDesligamento: "",
    tipoAvisoPrevio: 0,
    diasAvisoPrevio: 30,
    elegivelRecontratacao: false,
    substituirPosicao: false,
    observacoes: "",
};

/* ──────────────────────────── component ──────────────────────────── */

export default function DesligamentoFormModal({ open, editId, onClose, onSaved }: Props) {
    const [draft, setDraft] = useState<DesligamentoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);

    /* ── lookups ── */
    const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);

    const loadLookups = useCallback(async () => {
        const funcsRes = await fetchJson<Record<string, unknown>>("/api/lookup/funcionarios?pageSize=200").catch(() => ({ items: [] }));
        const funcItems = Array.isArray(funcsRes)
            ? funcsRes
            : Array.isArray((funcsRes as Record<string, unknown>)?.items)
                ? ((funcsRes as Record<string, unknown>).items as { id: string; nome: string }[]).map((f) => ({ id: f.id, name: f.nome }))
                : [];
        setFuncionarios(funcItems as LookupItem[]);
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
                        dataDesligamento: d?.dataDesligamento ? String(d.dataDesligamento).slice(0, 10) : "",
                        tipoDesligamento: Number(d?.tipoDesligamento ?? 0),
                        motivoDesligamento: String(d?.motivoDesligamento ?? ""),
                        tipoAvisoPrevio: Number(d?.tipoAvisoPrevio ?? 0),
                        diasAvisoPrevio: Number(d?.diasAvisoPrevio ?? 30),
                        elegivelRecontratacao: Boolean(d?.elegivelRecontratacao),
                        substituirPosicao: Boolean(d?.substituirPosicao),
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
        if (!draft.dataDesligamento) {
            toast.error("A data de desligamento é obrigatória.");
            return;
        }
        if (!draft.motivoDesligamento.trim()) {
            toast.error("O motivo de desligamento é obrigatório.");
            return;
        }
        setSaving(true);
        const payload = {
            funcionarioId: draft.funcionarioId,
            dataDesligamento: draft.dataDesligamento,
            tipoDesligamento: draft.tipoDesligamento,
            motivoDesligamento: draft.motivoDesligamento.trim(),
            tipoAvisoPrevio: draft.tipoAvisoPrevio,
            diasAvisoPrevio: draft.diasAvisoPrevio,
            elegivelRecontratacao: draft.elegivelRecontratacao,
            substituirPosicao: draft.substituirPosicao,
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
                    <DialogTitle>{editId ? "Editar Desligamento" : "Nova Solicitação de Desligamento"}</DialogTitle>
                    <DialogDescription>
                        {editId ? "Atualize os dados da solicitação de desligamento." : "Preencha os dados para solicitar um desligamento."}
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

                        <div className="grid grid-cols-2 gap-3">
                            {/* Data de Desligamento */}
                            <div>
                                <label className={labelClass}>Data de Desligamento *</label>
                                <Input
                                    type="date"
                                    value={draft.dataDesligamento}
                                    onChange={(e) => setDraft((d) => ({ ...d, dataDesligamento: e.target.value }))}
                                />
                            </div>

                            {/* Tipo de Desligamento */}
                            <div>
                                <label className={labelClass}>Tipo de Desligamento</label>
                                <select
                                    className={selectClass}
                                    value={draft.tipoDesligamento}
                                    onChange={(e) => setDraft((d) => ({ ...d, tipoDesligamento: Number(e.target.value) }))}
                                >
                                    <option value={0}>Sem Justa Causa</option>
                                    <option value={1}>Pedido de Demissão</option>
                                    <option value={2}>Acordo Mútuo</option>
                                    <option value={3}>Justa Causa</option>
                                    <option value={4}>Fim de Contrato</option>
                                </select>
                            </div>
                        </div>

                        {/* Motivo */}
                        <div>
                            <label className={labelClass}>Motivo do Desligamento *</label>
                            <textarea
                                className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                rows={3}
                                value={draft.motivoDesligamento}
                                onChange={(e) => setDraft((d) => ({ ...d, motivoDesligamento: e.target.value }))}
                                placeholder="Descreva o motivo do desligamento..."
                                maxLength={2000}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Tipo Aviso Prévio */}
                            <div>
                                <label className={labelClass}>Tipo de Aviso Prévio</label>
                                <select
                                    className={selectClass}
                                    value={draft.tipoAvisoPrevio}
                                    onChange={(e) => setDraft((d) => ({ ...d, tipoAvisoPrevio: Number(e.target.value) }))}
                                >
                                    <option value={0}>Indenizado</option>
                                    <option value={1}>Trabalhado</option>
                                    <option value={2}>Dispensado</option>
                                </select>
                            </div>

                            {/* Dias Aviso Prévio */}
                            <div>
                                <label className={labelClass}>Dias de Aviso Prévio</label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={draft.diasAvisoPrevio}
                                    onChange={(e) => setDraft((d) => ({ ...d, diasAvisoPrevio: Math.max(0, Number(e.target.value)) }))}
                                />
                            </div>
                        </div>

                        {/* Checkboxes */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={draft.elegivelRecontratacao}
                                        onChange={(e) => setDraft((d) => ({ ...d, elegivelRecontratacao: e.target.checked }))}
                                        className="rounded border-input"
                                    />
                                    <span className="text-sm">Elegível para recontratação</span>
                                </label>
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={draft.substituirPosicao}
                                        onChange={(e) => setDraft((d) => ({ ...d, substituirPosicao: e.target.checked }))}
                                        className="rounded border-input"
                                    />
                                    <span className="text-sm">Substituir posição após desligamento</span>
                                </label>
                            </div>
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
