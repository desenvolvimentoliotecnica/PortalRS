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

interface SolicitacaoDraft {
    titulo: string;
    justificativa: string;
    qtdPosicoes: number;
    urgencia: number;
    jobPositionId: string | null;
    areaId: string | null;
    unitId: string | null;
    aprovadorId: string | null;
    // Sprint 1
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoFuncionarioId: string | null;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

/* ──────────────────────────── helpers ──────────────────────────── */

const API = "/api/solicitacoes-vaga";

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

const emptyDraft: SolicitacaoDraft = {
    titulo: "",
    justificativa: "",
    qtdPosicoes: 1,
    urgencia: 1,
    jobPositionId: null,
    areaId: null,
    unitId: null,
    aprovadorId: null,
    tipoSolicitacao: 0,
    isConfidencial: false,
    substituidoFuncionarioId: null,
};

/* ──────────────────────────── component ──────────────────────────── */

export default function SolicitacaoFormModal({ open, editId, onClose, onSaved }: Props) {
    const [draft, setDraft] = useState<SolicitacaoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);

    /* ── lookups ── */
    const [areas, setAreas] = useState<LookupItem[]>([]);
    const [cargos, setCargos] = useState<LookupItem[]>([]);
    const [unidades, setUnidades] = useState<LookupItem[]>([]);
    const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);

    const loadLookups = useCallback(async () => {
        const [areasRes, cargosRes, unidadesRes, funcsRes] = await Promise.all([
            fetchJson<LookupItem[]>("/api/lookup/areas").catch(() => []),
            fetchJson<LookupItem[]>("/api/lookup/job-positions").catch(() => []),
            fetchJson<LookupItem[]>("/api/lookup/units").catch(() => []),
            fetchJson<Record<string, unknown>>("/api/lookup/funcionarios?pageSize=200").catch(() => ({ items: [] })),
        ]);
        setAreas(Array.isArray(areasRes) ? areasRes : []);
        setCargos(Array.isArray(cargosRes) ? cargosRes : []);
        setUnidades(Array.isArray(unidadesRes) ? unidadesRes : []);
        const funcItems = Array.isArray(funcsRes) ? funcsRes : Array.isArray((funcsRes as Record<string, unknown>)?.items) ? ((funcsRes as Record<string, unknown>).items as { id: string; nome: string }[]).map((f) => ({ id: f.id, name: f.nome })) : [];
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
                        titulo: String(d?.titulo ?? ""),
                        justificativa: String(d?.justificativa ?? ""),
                        qtdPosicoes: Number(d?.qtdPosicoes ?? 1),
                        urgencia: Number(d?.urgencia ?? 1),
                        jobPositionId: d?.jobPositionId ? String(d.jobPositionId) : null,
                        areaId: d?.areaId ? String(d.areaId) : null,
                        unitId: d?.unitId ? String(d.unitId) : null,
                        aprovadorId: d?.aprovadorId ? String(d.aprovadorId) : null,
                        tipoSolicitacao: Number(d?.tipoSolicitacao ?? 0),
                        isConfidencial: Boolean(d?.isConfidencial),
                        substituidoFuncionarioId: d?.substituidoFuncionarioId ? String(d.substituidoFuncionarioId) : null,
                    });
                })
                .catch(() => toast.error("Falha ao carregar solicitação."))
                .finally(() => setLoadingEdit(false));
        } else {
            setDraft({ ...emptyDraft });
        }
    }, [open, editId, loadLookups]);

    async function save() {
        if (!draft.titulo.trim()) {
            toast.error("O título é obrigatório.");
            return;
        }
        setSaving(true);
        const payload = {
            titulo: draft.titulo.trim(),
            justificativa: draft.justificativa.trim() || null,
            qtdPosicoes: Math.max(draft.qtdPosicoes, 1),
            urgencia: draft.urgencia,
            jobPositionId: draft.jobPositionId || null,
            areaId: draft.areaId || null,
            unitId: draft.unitId || null,
            aprovadorId: draft.aprovadorId || null,
            tipoSolicitacao: draft.tipoSolicitacao,
            isConfidencial: draft.isConfidencial,
            substituidoFuncionarioId: draft.tipoSolicitacao === 1 ? (draft.substituidoFuncionarioId || null) : null,
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
                    <DialogTitle>{editId ? "Editar Solicitação" : "Nova Solicitação de Vaga"}</DialogTitle>
                    <DialogDescription>
                        {editId ? "Atualize os dados da solicitação." : "Preencha os dados para solicitar uma nova vaga."}
                    </DialogDescription>
                </DialogHeader>

                {loadingEdit ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Título */}
                        <div>
                            <label className={labelClass}>Título *</label>
                            <Input
                                value={draft.titulo}
                                onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
                                placeholder="Ex: Analista de Dados Pleno"
                                maxLength={160}
                            />
                        </div>

                        {/* Justificativa */}
                        <div>
                            <label className={labelClass}>Justificativa</label>
                            <textarea
                                className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                rows={3}
                                value={draft.justificativa}
                                onChange={(e) => setDraft((d) => ({ ...d, justificativa: e.target.value }))}
                                placeholder="Justifique a necessidade da contratação..."
                                maxLength={2000}
                            />
                        </div>

                        {/* Sprint 1: Tipo + Confidencial */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Tipo de Solicitação *</label>
                                <select
                                    className={selectClass}
                                    value={draft.tipoSolicitacao}
                                    onChange={(e) => setDraft((d) => ({ ...d, tipoSolicitacao: Number(e.target.value) }))}
                                >
                                    <option value={0}>Vaga Nova</option>
                                    <option value={1}>Substituição</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer pb-2">
                                    <input
                                        type="checkbox"
                                        checked={draft.isConfidencial}
                                        onChange={(e) => setDraft((d) => ({ ...d, isConfidencial: e.target.checked }))}
                                        className="rounded border-input"
                                    />
                                    <span className="text-sm">Vaga Confidencial</span>
                                </label>
                            </div>
                        </div>

                        {/* Sprint 1: Substituto */}
                        {draft.tipoSolicitacao === 1 && (
                            <div>
                                <label className={labelClass}>Funcionário Substituído *</label>
                                <select
                                    className={selectClass}
                                    value={draft.substituidoFuncionarioId ?? ""}
                                    onChange={(e) => setDraft((d) => ({ ...d, substituidoFuncionarioId: e.target.value || null }))}
                                >
                                    <option value="">Selecione o funcionário...</option>
                                    {funcionarios.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            {/* Posições */}
                            <div>
                                <label className={labelClass}>Qtd. posições</label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={draft.qtdPosicoes}
                                    onChange={(e) => setDraft((d) => ({ ...d, qtdPosicoes: Math.max(1, Number(e.target.value)) }))}
                                />
                            </div>

                            {/* Urgência */}
                            <div>
                                <label className={labelClass}>Urgência</label>
                                <select
                                    className={selectClass}
                                    value={draft.urgencia}
                                    onChange={(e) => setDraft((d) => ({ ...d, urgencia: Number(e.target.value) }))}
                                >
                                    <option value={0}>Baixa</option>
                                    <option value={1}>Média</option>
                                    <option value={2}>Alta</option>
                                    <option value={3}>Crítica</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Cargo */}
                            <div>
                                <label className={labelClass}>Cargo</label>
                                <select
                                    className={selectClass}
                                    value={draft.jobPositionId ?? ""}
                                    onChange={(e) => setDraft((d) => ({ ...d, jobPositionId: e.target.value || null }))}
                                >
                                    <option value="">Selecione...</option>
                                    {cargos.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Área */}
                            <div>
                                <label className={labelClass}>Área</label>
                                <select
                                    className={selectClass}
                                    value={draft.areaId ?? ""}
                                    onChange={(e) => setDraft((d) => ({ ...d, areaId: e.target.value || null }))}
                                >
                                    <option value="">Selecione...</option>
                                    {areas.map((a) => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Unidade */}
                            <div>
                                <label className={labelClass}>Unidade</label>
                                <select
                                    className={selectClass}
                                    value={draft.unitId ?? ""}
                                    onChange={(e) => setDraft((d) => ({ ...d, unitId: e.target.value || null }))}
                                >
                                    <option value="">Selecione...</option>
                                    {unidades.map((u) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Aprovador */}
                            <div>
                                <label className={labelClass}>Aprovador</label>
                                <select
                                    className={selectClass}
                                    value={draft.aprovadorId ?? ""}
                                    onChange={(e) => setDraft((d) => ({ ...d, aprovadorId: e.target.value || null }))}
                                >
                                    <option value="">Selecione...</option>
                                    {funcionarios.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
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
