"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { HorarioEditor } from "@/components/gestao/HorarioEditor";

/* ──────────────────────────── types ──────────────────────────── */

interface LookupItem {
    id: string;
    name: string;
    code?: string;
}

export interface SolicitacaoDraft {
    titulo: string;
    justificativa: string;
    qtdPosicoes: number;
    urgencia: number;
    jobPositionId: string | null;
    origemVaga: "quadro" | "nova";
    areaId: string | null;
    unitId: string | null;
    aprovadorId: string | null;
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoFuncionarioId: string | null;
    tipoContrato: number;
    prazoDias: number | null;
    motivoRequisicao: number | null;
    cnhObrigatoria: boolean;
    disponibilidadeViagens: boolean;
    escalaTrabalho: string;
    empresaId: string | null;
    centroCustoId: string | null;
    unidadeLotacaoId: string | null;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
    viewOnly?: boolean;
    resubmitAfterSave?: boolean;
    /** When set, loads source data pre-filled as a new solicitation (copy mode). */
    copySourceId?: string | null;
    /** When set (and no editId/copySourceId), pre-fills the draft with this data (e.g. from quadro de vagas). */
    initialData?: Partial<SolicitacaoDraft> | null;
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
    origemVaga: "nova",
    areaId: null,
    unitId: null,
    aprovadorId: null,
    tipoSolicitacao: 0,
    isConfidencial: false,
    substituidoFuncionarioId: null,
    tipoContrato: 0,
    prazoDias: null,
    motivoRequisicao: null,
    cnhObrigatoria: false,
    disponibilidadeViagens: false,
    escalaTrabalho: "",
    empresaId: null,
    centroCustoId: null,
    unidadeLotacaoId: null,
};

/* ──────────────────────────── AutocompleteSelect ──────────────────────────── */

function AutocompleteSelect({
    items,
    value,
    onChange,
    placeholder,
    required,
    disabled,
}: {
    items: LookupItem[];
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder: string;
    required?: boolean;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = items.find((i) => i.id === value) ?? null;
    const displayText = selected ? (selected.code ? `${selected.code} – ${selected.name}` : selected.name) : "";

    if (disabled) {
        return (
            <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                {displayText || <span className="italic opacity-40">—</span>}
            </div>
        );
    }

    const filtered = query.trim()
        ? items.filter((i) => {
              const q = query.toLowerCase();
              return i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q));
          })
        : items;

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className="flex gap-1">
                <input
                    className={`h-9 flex-1 rounded-md border px-3 text-sm bg-background ${required && !value ? "border-red-400" : "border-input"}`}
                    placeholder={`Buscar ${placeholder}...`}
                    value={open ? query : displayText}
                    onFocus={() => { setOpen(true); setQuery(""); }}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {value && (
                    <button type="button" onClick={() => { onChange(null); setQuery(""); }} className="px-2 text-muted-foreground hover:text-foreground text-xs" tabIndex={-1}>✕</button>
                )}
            </div>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</div>
                    ) : (
                        filtered.slice(0, 80).map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); onChange(item.id); setOpen(false); setQuery(""); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${item.id === value ? "bg-muted font-medium" : ""}`}
                            >
                                {item.code && <span className="text-xs text-muted-foreground font-mono w-20 shrink-0 truncate">{item.code}</span>}
                                <span className="truncate">{item.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function SolicitacaoFormModal({ open, editId, onClose, onSaved, viewOnly, resubmitAfterSave, copySourceId, initialData }: Props) {
    const [draft, setDraft] = useState<SolicitacaoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState("identificacao");

    /* ── lookups ── */
    const [cargos, setCargos] = useState<LookupItem[]>([]);
    const [unidades, setUnidades] = useState<LookupItem[]>([]);
    const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);
    const [empresas, setEmpresas] = useState<LookupItem[]>([]);
    const [centrosCusto, setCentrosCusto] = useState<LookupItem[]>([]);
    const [unidadesLotacao, setUnidadesLotacao] = useState<LookupItem[]>([]);
    const [gestorDiretoId, setGestorDiretoId] = useState<string | null>(null);

    const loadLookups = useCallback(async () => {
        type OptionRes = { id: string; name: string; code?: string };
        const [cargosRes, unidadesRes, funcsRes, empresasRes, ccRes, lotacaoRes] = await Promise.all([
            fetchJson<OptionRes[]>("/api/lookup/job-positions").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/units").catch(() => []),
            fetchJson<Record<string, unknown>>("/api/lookup/funcionarios?pageSize=200").catch(() => ({ items: [] })),
            fetchJson<OptionRes[]>("/api/lookup/empresas").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/centros-custo").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/unidades-lotacao").catch(() => []),
        ]);
        setCargos(Array.isArray(cargosRes) ? cargosRes : []);
        setUnidades(Array.isArray(unidadesRes) ? unidadesRes : []);
        setEmpresas(Array.isArray(empresasRes) ? empresasRes : []);
        setCentrosCusto(Array.isArray(ccRes) ? ccRes : []);
        setUnidadesLotacao(Array.isArray(lotacaoRes) ? lotacaoRes : []);

        const funcItems = Array.isArray(funcsRes)
            ? funcsRes
            : Array.isArray((funcsRes as Record<string, unknown>)?.items)
                ? ((funcsRes as Record<string, unknown>).items as { id: string; nome: string }[]).map((f) => ({ id: f.id, name: f.nome }))
                : [];
        setFuncionarios(funcItems as LookupItem[]);

        try {
            const meRes = await fetchJson<Record<string, unknown>>("/api/me");
            const myFuncId = meRes?.funcionarioId as string | null;
            if (myFuncId) {
                const funcRes = await fetchJson<Record<string, unknown>>(`/api/funcionarios/${myFuncId}`);
                const gdId = funcRes?.gestorDiretoId as string | null;
                if (gdId) setGestorDiretoId(gdId);
            }
        } catch { /* ignore */ }
    }, []);

    function parseDraft(d: Record<string, unknown>, titleSuffix = ""): SolicitacaoDraft {
        return {
            titulo: String(d?.titulo ?? "") + titleSuffix,
            justificativa: String(d?.justificativa ?? ""),
            qtdPosicoes: Number(d?.qtdPosicoes ?? 1),
            urgencia: (() => { const map: Record<string, number> = { Baixa: 0, Media: 1, Alta: 2, Critica: 3 }; const v = d?.urgencia; return typeof v === "number" ? v : (map[v as string] ?? 1); })(),
            jobPositionId: d?.jobPositionId ? String(d.jobPositionId) : null,
            origemVaga: d?.jobPositionId ? "quadro" : "nova",
            areaId: d?.areaId ? String(d.areaId) : null,
            unitId: d?.unitId ? String(d.unitId) : null,
            aprovadorId: d?.aprovadorId ? String(d.aprovadorId) : null,
            tipoSolicitacao: (() => { const m: Record<string, number> = { VagaNova: 0, Substituicao: 1 }; const v = d?.tipoSolicitacao; return typeof v === "number" ? v : (m[v as string] ?? 0); })(),
            isConfidencial: Boolean(d?.isConfidencial),
            substituidoFuncionarioId: d?.substituidoFuncionarioId ? String(d.substituidoFuncionarioId) : null,
            tipoContrato: (() => { const m: Record<string, number> = { CLT: 0, Estagio: 1, Aprendiz: 2, Temporario: 3 }; const v = d?.tipoContrato; return typeof v === "number" ? v : (m[v as string] ?? 0); })(),
            prazoDias: d?.prazoDias != null ? Number(d.prazoDias) : null,
            motivoRequisicao: (() => { const m: Record<string, number> = { AtenderDemanda: 0, PedidoDemissao: 1, DesligamentoSemJustaCausa: 2, CotaAprendiz: 3, TerminoContrato: 4, ExpansaoBase: 5, NovaUnidade: 6, Movimentacao: 7, Afastamento: 8 }; const v = d?.motivoRequisicao; return v == null ? null : typeof v === "number" ? v : (m[v as string] ?? null); })(),
            cnhObrigatoria: Boolean(d?.cnhObrigatoria),
            disponibilidadeViagens: Boolean(d?.disponibilidadeViagens),
            escalaTrabalho: String(d?.escalaTrabalho ?? ""),
            empresaId: d?.empresaId ? String(d.empresaId) : null,
            centroCustoId: d?.centroCustoId ? String(d.centroCustoId) : null,
            unidadeLotacaoId: d?.unidadeLotacaoId ? String(d.unidadeLotacaoId) : null,
        };
    }

    useEffect(() => {
        if (!open) return;
        setActiveTab("identificacao");
        loadLookups();

        const sourceId = editId ?? copySourceId ?? null;
        if (sourceId) {
            setLoadingEdit(true);
            fetchJson<Record<string, unknown>>(`${API}/${sourceId}`)
                .then((d) => setDraft(parseDraft(d, copySourceId ? " (cópia)" : "")))
                .catch(() => toast.error("Falha ao carregar solicitação."))
                .finally(() => setLoadingEdit(false));
        } else {
            setDraft(initialData ? { ...emptyDraft, ...initialData } : { ...emptyDraft });
        }
    }, [open, editId, copySourceId, initialData, loadLookups]);

    useEffect(() => {
        if (gestorDiretoId && !editId && !draft.aprovadorId) {
            setDraft((d) => ({ ...d, aprovadorId: gestorDiretoId }));
        }
    }, [gestorDiretoId, editId, draft.aprovadorId]);

    async function save() {
        if (viewOnly) return;
        const errors: string[] = [];
        if (!draft.titulo.trim()) errors.push("Título");
        if (!draft.empresaId) errors.push("Empresa");
        if (!draft.unitId) errors.push("Local (Unidade)");
        if (!draft.centroCustoId) errors.push("Centro de Custo");
        if (!draft.unidadeLotacaoId) errors.push("Lotação");
        if (draft.motivoRequisicao === null) errors.push("Motivo da Requisição");
        if (errors.length > 0) {
            toast.error(`Campos obrigatórios: ${errors.join(", ")}.`);
            return;
        }

        setSaving(true);
        const payload = {
            titulo: draft.titulo.trim(),
            justificativa: draft.justificativa.trim() || null,
            qtdPosicoes: Math.max(draft.qtdPosicoes, 1),
            urgencia: (["Baixa", "Media", "Alta", "Critica"][draft.urgencia] ?? "Media"),
            jobPositionId: draft.jobPositionId || null,
            areaId: draft.areaId || null,
            unitId: draft.unitId,
            aprovadorId: draft.aprovadorId || null,
            tipoSolicitacao: (["VagaNova", "Substituicao"][draft.tipoSolicitacao] ?? "VagaNova"),
            isConfidencial: draft.isConfidencial,
            substituidoFuncionarioId: draft.tipoSolicitacao === 1 ? (draft.substituidoFuncionarioId || null) : null,
            tipoContrato: (["CLT", "Estagio", "Aprendiz", "Temporario"][draft.tipoContrato] ?? "CLT"),
            prazoDias: draft.tipoContrato !== 0 ? draft.prazoDias : null,
            motivoRequisicao: draft.motivoRequisicao !== null ? (["AtenderDemanda", "PedidoDemissao", "DesligamentoSemJustaCausa", "CotaAprendiz", "TerminoContrato", "ExpansaoBase", "NovaUnidade", "Movimentacao", "Afastamento"][draft.motivoRequisicao] ?? null) : null,
            cnhObrigatoria: draft.cnhObrigatoria,
            disponibilidadeViagens: draft.disponibilidadeViagens,
            escalaTrabalho: draft.escalaTrabalho || null,
            empresaId: draft.empresaId,
            centroCustoId: draft.centroCustoId,
            unidadeLotacaoId: draft.unidadeLotacaoId,
        };

        try {
            if (editId) {
                await fetchJson(`${API}/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (resubmitAfterSave) {
                    await fetchJson(`${API}/${editId}/submit`, { method: "POST" });
                    toast.success("Solicitação atualizada e reenviada para aprovação!");
                } else {
                    toast.success("Solicitação atualizada.");
                }
            } else {
                const res = await apiFetch(API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    let msg = `HTTP ${res.status}`;
                    try { const j = await res.json() as { message?: string; title?: string }; msg = j?.message ?? j?.title ?? msg; } catch { /* ignore */ }
                    throw new Error(msg);
                }
                const created = await res.json() as { id?: string };
                if (created?.id) {
                    const submitRes = await apiFetch(`${API}/${created.id}/submit`, { method: "POST" });
                    if (submitRes.ok || submitRes.status === 204) {
                        toast.success("Solicitação criada e enviada para aprovação!");
                    } else {
                        toast.success("Solicitação criada (envie manualmente para aprovação).");
                    }
                } else {
                    toast.success("Solicitação criada.");
                }
            }
            onSaved();
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    const L = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1";
    const S = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

    const Section = ({ title }: { title: string }) => (
        <div className="col-span-full">
            <div className="flex items-center gap-2 my-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
                <div className="flex-1 border-t border-border" />
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {viewOnly ? "Visualizar Requisição de Pessoal" : copySourceId ? "Copiar Requisição de Pessoal" : editId ? "Editar Requisição de Pessoal" : "Requisição de Pessoal"}
                    </DialogTitle>
                </DialogHeader>

                {loadingEdit ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
                        <TabsList className="mb-4">
                            <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                            <TabsTrigger value="horario">Horário</TabsTrigger>
                            <TabsTrigger value="aprovacao">Aprovação</TabsTrigger>
                        </TabsList>

                        {/* ══════════════ TAB 1 — Identificação + Dados da Vaga ══════════════ */}
                        <TabsContent value="identificacao">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3">

                                <Section title="Identificação" />

                                <div className="col-span-2">
                                    <label className={L}>Empresa *</label>
                                    <AutocompleteSelect items={empresas} value={draft.empresaId} onChange={(v) => setDraft((d) => ({ ...d, empresaId: v }))} placeholder="empresa" required disabled={viewOnly} />
                                </div>

                                <div>
                                    <label className={L}>Tipo de Contrato</label>
                                    <select className={S} value={draft.tipoContrato} onChange={(e) => setDraft((d) => ({ ...d, tipoContrato: Number(e.target.value), prazoDias: null }))} disabled={viewOnly}>
                                        <option value={0}>CLT</option>
                                        <option value={1}>Estágio</option>
                                        <option value={2}>Aprendiz</option>
                                        <option value={3}>Temporário</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className={L}>Local (Unidade) *</label>
                                    <AutocompleteSelect items={unidades} value={draft.unitId} onChange={(v) => setDraft((d) => ({ ...d, unitId: v }))} placeholder="unidade" required disabled={viewOnly} />
                                </div>

                                <div>
                                    {draft.tipoContrato !== 0 ? (
                                        <>
                                            <label className={L}>Prazo (dias)</label>
                                            <Input type="number" min={1} value={draft.prazoDias ?? ""} onChange={(e) => setDraft((d) => ({ ...d, prazoDias: e.target.value ? Number(e.target.value) : null }))} placeholder="Ex: 180" disabled={viewOnly} />
                                        </>
                                    ) : <div />}
                                </div>

                                <div className="col-span-2">
                                    <label className={L}>Centro de Custo *</label>
                                    <AutocompleteSelect items={centrosCusto} value={draft.centroCustoId} onChange={(v) => setDraft((d) => ({ ...d, centroCustoId: v }))} placeholder="centro de custo" required disabled={viewOnly} />
                                </div>

                                <div>
                                    <label className={L}>Qtd. Posições</label>
                                    <Input type="number" min={1} value={draft.qtdPosicoes} onChange={(e) => setDraft((d) => ({ ...d, qtdPosicoes: Math.max(1, Number(e.target.value)) }))} disabled={viewOnly} />
                                </div>

                                <div className="col-span-2">
                                    <label className={L}>Lotação *</label>
                                    <AutocompleteSelect items={unidadesLotacao} value={draft.unidadeLotacaoId} onChange={(v) => setDraft((d) => ({ ...d, unidadeLotacaoId: v }))} placeholder="lotação" required disabled={viewOnly} />
                                </div>

                                <div>
                                    <label className={L}>Urgência</label>
                                    <select className={S} value={draft.urgencia} onChange={(e) => setDraft((d) => ({ ...d, urgencia: Number(e.target.value) }))} disabled={viewOnly}>
                                        <option value={0}>Baixa</option>
                                        <option value={1}>Média</option>
                                        <option value={2}>Alta</option>
                                        <option value={3}>Crítica</option>
                                    </select>
                                </div>

                                <Section title="Dados da Vaga" />

                                {/* Origem da vaga */}
                                <div className="col-span-3 flex gap-3">
                                    {(["quadro", "nova"] as const).map((opt) => (
                                        <label
                                            key={opt}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer select-none transition-colors ${
                                                draft.origemVaga === opt
                                                    ? "border-lt-primary bg-lt-primary/10 text-lt-primary font-medium"
                                                    : "border-input bg-background text-muted-foreground hover:bg-muted/40"
                                            } ${viewOnly ? "cursor-default pointer-events-none" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                className="sr-only"
                                                name="origemVaga"
                                                value={opt}
                                                checked={draft.origemVaga === opt}
                                                disabled={viewOnly}
                                                onChange={() => setDraft((d) => ({
                                                    ...d,
                                                    origemVaga: opt,
                                                    jobPositionId: opt === "nova" ? null : d.jobPositionId,
                                                }))}
                                            />
                                            {opt === "quadro" ? "Do quadro de vagas" : "Nova posição"}
                                        </label>
                                    ))}
                                </div>

                                {draft.origemVaga === "quadro" && (
                                    <div className="col-span-2">
                                        <label className={L}>Cargo do quadro de vagas</label>
                                        <AutocompleteSelect
                                            items={cargos}
                                            value={draft.jobPositionId}
                                            onChange={(v) => {
                                                const cargo = v ? cargos.find((c) => c.id === v) : null;
                                                setDraft((d) => ({
                                                    ...d,
                                                    jobPositionId: v,
                                                    titulo: cargo ? cargo.name : d.titulo,
                                                }));
                                            }}
                                            placeholder="cargo do quadro"
                                            disabled={viewOnly}
                                        />
                                    </div>
                                )}

                                {draft.origemVaga === "nova" && (
                                    <div className="col-span-2">
                                        <label className={L}>Título da Vaga *</label>
                                        <Input value={draft.titulo} onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))} placeholder="Ex: Analista de RH Pleno" maxLength={160} disabled={viewOnly} />
                                    </div>
                                )}

                                <div>
                                    <label className={L}>Tipo de Solicitação</label>
                                    <select className={S} value={draft.tipoSolicitacao} onChange={(e) => setDraft((d) => ({ ...d, tipoSolicitacao: Number(e.target.value) }))} disabled={viewOnly}>
                                        <option value={0}>Vaga Nova</option>
                                        <option value={1}>Substituição</option>
                                    </select>
                                </div>

                                {draft.origemVaga === "quadro" && (
                                    <div className="col-span-3">
                                        <label className={L}>Título da Vaga *</label>
                                        <Input value={draft.titulo} onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))} placeholder="Ex: Analista de RH Pleno" maxLength={160} disabled={viewOnly} />
                                    </div>
                                )}

                                {draft.tipoSolicitacao === 1 && (
                                    <div className="col-span-2">
                                        <label className={L}>Funcionário Substituído</label>
                                        <AutocompleteSelect items={funcionarios} value={draft.substituidoFuncionarioId} onChange={(v) => setDraft((d) => ({ ...d, substituidoFuncionarioId: v }))} placeholder="funcionário substituído" required disabled={viewOnly} />
                                    </div>
                                )}

                                <div className="col-span-3">
                                    <label className={L}>Motivo da Requisição *</label>
                                    <select className={S} value={draft.motivoRequisicao ?? ""} onChange={(e) => setDraft((d) => ({ ...d, motivoRequisicao: e.target.value !== "" ? Number(e.target.value) : null }))} disabled={viewOnly}>
                                        <option value="">Selecione...</option>
                                        <option value={0}>Atender Demanda</option>
                                        <option value={1}>Pedido de Demissão</option>
                                        <option value={2}>Desligamento Sem Justa Causa</option>
                                        <option value={3}>Cota Aprendiz</option>
                                        <option value={4}>Término de Contrato</option>
                                        <option value={5}>Expansão de Base</option>
                                        <option value={6}>Nova Unidade</option>
                                        <option value={7}>Movimentação</option>
                                        <option value={8}>Afastamento</option>
                                    </select>
                                </div>

                                <div className="col-span-3 flex items-center gap-6 py-1">
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.cnhObrigatoria} onChange={(e) => setDraft((d) => ({ ...d, cnhObrigatoria: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">CNH obrigatória</span>
                                    </label>
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.disponibilidadeViagens} onChange={(e) => setDraft((d) => ({ ...d, disponibilidadeViagens: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">Disponível para viagens</span>
                                    </label>
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.isConfidencial} onChange={(e) => setDraft((d) => ({ ...d, isConfidencial: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">Confidencial</span>
                                    </label>
                                </div>

                                <div className="col-span-3">
                                    <label className={L}>Justificativa</label>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground resize-none disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-default"
                                        rows={3}
                                        value={draft.justificativa}
                                        onChange={(e) => setDraft((d) => ({ ...d, justificativa: e.target.value }))}
                                        placeholder="Justifique a necessidade da contratação..."
                                        maxLength={2000}
                                        disabled={viewOnly}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* ══════════════ TAB 3 — Horário ══════════════ */}
                        <TabsContent value="horario">
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                    Selecione a escala na lista ou preencha manualmente os horários por dia da semana.
                                </p>
                                <HorarioEditor
                                    value={draft.escalaTrabalho}
                                    onChange={(v) => setDraft((d) => ({ ...d, escalaTrabalho: v }))}
                                    readonly={viewOnly}
                                />
                            </div>
                        </TabsContent>

                        {/* ══════════════ TAB 4 — Aprovação ══════════════ */}
                        <TabsContent value="aprovacao">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                                <div className="col-span-2">
                                    <label className={L}>Aprovador</label>
                                    <AutocompleteSelect items={funcionarios} value={draft.aprovadorId} onChange={(v) => setDraft((d) => ({ ...d, aprovadorId: v }))} placeholder="aprovador" disabled={viewOnly} />
                                    {gestorDiretoId && draft.aprovadorId === gestorDiretoId && (
                                        <p className="text-xs text-muted-foreground mt-1">Superior direto detectado automaticamente.</p>
                                    )}
                                    {!gestorDiretoId && (
                                        <p className="text-xs text-amber-600 mt-1">Sem gestor direto cadastrado. Selecione manualmente.</p>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                <DialogFooter className="mt-4">
                    {viewOnly ? (
                        <Button variant="outline" onClick={onClose}>Fechar</Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                            <Button onClick={() => void save()} disabled={saving || loadingEdit}>
                                {saving ? "Enviando…" : resubmitAfterSave ? "Salvar e reenviar para aprovação" : editId ? "Salvar alterações" : "Solicitar aprovação"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
