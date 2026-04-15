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
import { findEmpresaByCdn, findUnitByEstabCode } from "@/lib/funcionarioLookupResolve";
import { type OrgEstruturaResponse, type SubordinadoEntry, getSubordinados, filterSubordinadoEntries } from "@/lib/organograma";

/* ──────────────────────────── types ──────────────────────────── */

interface LookupItem {
    id: string;
    name: string;
    code?: string;
    sublabel?: string;
}

interface DesligamentoDraft {
    funcionarioId: string | null;
    empresaId: string | null;
    unitId: string | null;
    historicoMedidasDisciplinares: boolean | null;
    dataDesligamento: string;
    tipoDesligamento: number;
    motivoDesligamento: string;
    tipoAvisoPrevio: number;
    diasAvisoPrevio: number;
    possuiEstabilidade: boolean;
    elegivelRecontratacao: boolean;
    substituirPosicao: boolean;
    observacoes: string;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
    viewOnly?: boolean;
    resubmitAfterSave?: boolean;
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
    empresaId: null,
    unitId: null,
    historicoMedidasDisciplinares: null,
    dataDesligamento: "",
    tipoDesligamento: 0,
    motivoDesligamento: "",
    tipoAvisoPrevio: 0,
    diasAvisoPrevio: 30,
    possuiEstabilidade: false,
    elegivelRecontratacao: false,
    substituirPosicao: false,
    observacoes: "",
};

/* ──────────────────────────── AutocompleteSelect ──────────────────────────── */

function AutocompleteSelect({
    items,
    entries,
    value,
    onChange,
    placeholder,
    required,
    disabled,
}: {
    items?: LookupItem[];
    entries?: SubordinadoEntry[];
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder: string;
    required?: boolean;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Resolve display text from whichever source is active
    const selectedName = entries
        ? (entries.find((e) => e.id === value)?.name ?? "")
        : (() => { const s = items?.find((i) => i.id === value); return s ? (s.code ? `${s.code} – ${s.name}` : s.name) : ""; })();

    const displayText = selectedName;

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

    if (disabled) {
        return (
            <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                {displayText || <span className="italic opacity-40">—</span>}
            </div>
        );
    }

    // Tree mode (entries)
    if (entries) {
        const filtered = filterSubordinadoEntries(entries, query);

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
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-72 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</div>
                        ) : (
                            filtered.map((entry) => {
                                const indent = 8 + entry.depth * 18;
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onMouseDown={(e) => { e.preventDefault(); onChange(entry.id); setOpen(false); setQuery(""); }}
                                        className={`w-full text-left py-1.5 text-sm hover:bg-muted flex items-start gap-2 ${entry.id === value ? "bg-muted" : ""} ${entry.isGestor ? "border-t border-border/30" : ""}`}
                                        style={{ paddingLeft: indent }}
                                    >
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="flex items-center gap-1.5">
                                                {entry.isGestor && (
                                                    <span className="flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700">GESTOR</span>
                                                )}
                                                <span className={`truncate ${entry.isGestor ? "font-semibold" : ""}`}>{entry.name}</span>
                                            </div>
                                            {entry.cargo && (
                                                <div className="text-[10px] text-muted-foreground truncate">{entry.cargo}</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Flat mode (items)
    const flatItems = items ?? [];
    const filtered = query.trim()
        ? flatItems.filter((i) => {
              const q = query.toLowerCase();
              return i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q));
          })
        : flatItems;

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
                                <div className="min-w-0">
                                    <div className="truncate">{item.name}</div>
                                    {item.sublabel && <div className="text-[10px] text-muted-foreground truncate">{item.sublabel}</div>}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function DesligamentoFormModal({ open, editId, onClose, onSaved, viewOnly, resubmitAfterSave }: Props) {
    const [draft, setDraft] = useState<DesligamentoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState("identificacao");

    /* ── lookups ── */
    const [funcionarios, setFuncionarios] = useState<SubordinadoEntry[] | LookupItem[]>([]);
    const [empresas, setEmpresas] = useState<LookupItem[]>([]);
    const [unidades, setUnidades] = useState<LookupItem[]>([]);

    /* ── contexto do usuário logado ── */
    const [myFuncId, setMyFuncId] = useState<string | null>(null);

    /* ── dados atuais do funcionário (auto-preenchidos) ── */
    const [atualCargo, setAtualCargo] = useState("");

    /* ── campos bloqueados auto-preenchidos do funcionário ── */
    const [atualCodColaborador, setAtualCodColaborador] = useState("");
    const [atualEmpresaCodigo, setAtualEmpresaCodigo] = useState("");
    const [atualEmpresaNome, setAtualEmpresaNome] = useState("");
    const [atualEstabelecimentoCodigo, setAtualEstabelecimentoCodigo] = useState("");
    const [atualEstabelecimentoNome, setAtualEstabelecimentoNome] = useState("");

    const loadLookups = useCallback(async () => {
        type OptionRes = { id: string; name: string; code?: string };
        const [funcsRes, empresasRes, unidadesRes, meRes, orgRes] = await Promise.all([
            fetchJson<Record<string, unknown>>("/api/lookup/funcionarios?pageSize=500").catch(() => ({ items: [] })),
            fetchJson<OptionRes[]>("/api/lookup/empresas").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/units").catch(() => []),
            fetchJson<{ funcionarioId?: string }>("/api/me").catch(() => ({} as { funcionarioId?: string })),
            fetchJson<OrgEstruturaResponse>("/api/organograma/estrutura").catch(() => ({ lotacoes: [], semLotacao: [] })),
        ]);

        const empresasArr: LookupItem[] = Array.isArray(empresasRes) ? empresasRes : [];
        setEmpresas(empresasArr);
        setUnidades(Array.isArray(unidadesRes) ? unidadesRes : []);

        const meuFuncId = meRes?.funcionarioId ?? null;
        setMyFuncId(meuFuncId);

        if (meuFuncId) {
            const subordinados = getSubordinados(orgRes, meuFuncId);
            if (subordinados.length > 0) {
                setFuncionarios(subordinados);
                return;
            }
        }

        // Fallback: usuário não encontrado na estrutura (ex: admin sem lotação) — exibe todos
        const funcItems: LookupItem[] = Array.isArray(funcsRes)
            ? (funcsRes as LookupItem[])
            : Array.isArray((funcsRes as Record<string, unknown>)?.items)
                ? ((funcsRes as Record<string, unknown>).items as { id: string; nome: string }[]).map((f) => ({ id: f.id, name: f.nome }))
                : [];
        setFuncionarios(funcItems);
    }, []);

    /* fetch dados atuais quando funcionário muda */
    useEffect(() => {
        if (!draft.funcionarioId) {
            setAtualCodColaborador("");
            setAtualCargo("");
            setAtualEmpresaCodigo(""); setAtualEmpresaNome("");
            setAtualEstabelecimentoCodigo(""); setAtualEstabelecimentoNome("");
            setDraft((d) => ({ ...d, empresaId: null, unitId: null }));
            return;
        }
        fetchJson<Record<string, unknown>>(`/api/funcionarios/${draft.funcionarioId}`)
            .then((f) => {
                setAtualCodColaborador(f?.cdnFuncionario ? String(f.cdnFuncionario) : "");
                setAtualCargo(String(f?.jobPositionName ?? "—"));

                const cdnEmpresa = f?.cdnEmpresa ? String(f.cdnEmpresa) : null;
                const empresaMatch = findEmpresaByCdn(empresas, cdnEmpresa);
                setAtualEmpresaCodigo(cdnEmpresa?.trim() ?? "");
                setAtualEmpresaNome(empresaMatch?.name ?? "");

                const cdnEstab = f?.cdnEstab != null ? String(f.cdnEstab) : "";
                setAtualEstabelecimentoCodigo(cdnEstab.trim());

                let resolvedUnitId: string | null = f?.unitId ? String(f.unitId) : null;
                const unitMatch =
                    !resolvedUnitId && cdnEstab ? findUnitByEstabCode(unidades, cdnEstab) : null;
                if (!resolvedUnitId && unitMatch) resolvedUnitId = unitMatch.id;

                const unitNameApi = String(f?.unitName ?? "").trim();
                setAtualEstabelecimentoNome(unitNameApi || unitMatch?.name || "");

                setDraft((d) => ({
                    ...d,
                    empresaId: empresaMatch?.id ?? null,
                    unitId: resolvedUnitId,
                }));
            })
            .catch((e) => {
                toast.error(
                    `Não foi possível carregar o funcionário: ${e instanceof Error ? e.message : "erro"}`,
                );
            });
    }, [draft.funcionarioId, empresas, unidades]);

    useEffect(() => {
        if (!open) return;
        setActiveTab("identificacao");
        loadLookups();

        if (editId) {
            setLoadingEdit(true);
            fetchJson<Record<string, unknown>>(`${API}/${editId}`)
                .then((d) => {
                    const TIPO_DESL_MAP: Record<string, number> = {
                        SemJustaCausa: 0, PedidoDemissao: 1, AcordoMutuo: 2,
                        JustaCausa: 3, FimDeContrato: 4,
                    };
                    const TIPO_AVISO_MAP: Record<string, number> = {
                        Indenizado: 0, Trabalhado: 1, Dispensado: 2,
                    };
                    const parseTipoDesl = (v: unknown) =>
                        typeof v === "number" ? v : (TIPO_DESL_MAP[String(v ?? "")] ?? 0);
                    const parseTipoAviso = (v: unknown) =>
                        typeof v === "number" ? v : (TIPO_AVISO_MAP[String(v ?? "")] ?? 0);

                    setDraft({
                        funcionarioId: d?.funcionarioId ? String(d.funcionarioId) : null,
                        empresaId: d?.empresaId ? String(d.empresaId) : null,
                        unitId: d?.unitId ? String(d.unitId) : null,
                        historicoMedidasDisciplinares: d?.historicoMedidasDisciplinares != null
                            ? Boolean(d.historicoMedidasDisciplinares) : null,
                        dataDesligamento: d?.dataDesligamento ? String(d.dataDesligamento).slice(0, 10) : "",
                        tipoDesligamento: parseTipoDesl(d?.tipoDesligamento),
                        motivoDesligamento: String(d?.motivoDesligamento ?? ""),
                        tipoAvisoPrevio: parseTipoAviso(d?.tipoAvisoPrevio),
                        diasAvisoPrevio: Number(d?.diasAvisoPrevio ?? 30),
                        possuiEstabilidade: Boolean(d?.possuiEstabilidade),
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
        if (viewOnly) return;

        const errors: string[] = [];
        if (!draft.funcionarioId) errors.push("Funcionário");
        if (!draft.empresaId) errors.push("Empresa (código da empresa do funcionário não bate com o cadastro)");
        if (!draft.unitId) errors.push("Estabelecimento (código do estabelecimento sem unidade correspondente no portal)");
        if (!draft.dataDesligamento) errors.push("Data de Desligamento");
        if (!draft.motivoDesligamento.trim()) errors.push("Justificativa");

        if (errors.length > 0) {
            toast.error(`Campos obrigatórios: ${errors.join(", ")}.`);
            return;
        }

        setSaving(true);

        const TIPO_DESL_STR = ["SemJustaCausa", "PedidoDemissao", "AcordoMutuo", "JustaCausa", "FimDeContrato"];
        const TIPO_AVISO_STR = ["Indenizado", "Trabalhado", "Dispensado"];

        const payload = {
            funcionarioId: draft.funcionarioId,
            empresaId: draft.empresaId,
            unitId: draft.unitId,
            historicoMedidasDisciplinares: draft.historicoMedidasDisciplinares,
            dataDesligamento: draft.dataDesligamento,
            tipoDesligamento: TIPO_DESL_STR[draft.tipoDesligamento] ?? "SemJustaCausa",
            motivoDesligamento: draft.motivoDesligamento.trim(),
            tipoAvisoPrevio: TIPO_AVISO_STR[draft.tipoAvisoPrevio] ?? "Indenizado",
            diasAvisoPrevio: draft.diasAvisoPrevio,
            possuiEstabilidade: draft.possuiEstabilidade,
            elegivelRecontratacao: draft.elegivelRecontratacao,
            substituirPosicao: draft.substituirPosicao,
            observacoes: draft.observacoes.trim() || null,
        };

        try {
            if (editId) {
                await fetchJson(`${API}/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                if (resubmitAfterSave) {
                    await fetchJson(`${API}/${editId}/submit`, { method: "POST" });
                    toast.success("Solicitação atualizada e reenviada para aprovação.");
                } else {
                    toast.success("Solicitação atualizada.");
                }
            } else {
                const created = await fetchJson<{ id?: string }>(API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!created?.id) {
                    throw new Error("Solicitação criada sem identificador para envio.");
                }
                await fetchJson(`${API}/${created.id}/submit`, { method: "POST" });
                toast.success("Solicitação criada e enviada para aprovação.");
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

    const ReadonlyField = ({ value }: { value?: string }) => (
        <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
            {value || <span className="italic opacity-40">—</span>}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {viewOnly ? "Visualizar Solicitação de Desligamento" : editId ? "Editar Solicitação de Desligamento" : "Solicitação de Desligamento"}
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
                            <TabsTrigger value="desligamento">Desligamento</TabsTrigger>
                        </TabsList>

                        {/* ══════════════ TAB 1 — Identificação ══════════════ */}
                        <TabsContent value="identificacao">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3">

                                {/* 1. Funcionário */}
                                <div className="col-span-3">
                                    <label className={L}>Funcionário *</label>
                                    {(() => {
                                        const isTree = funcionarios.length > 0 && "type" in funcionarios[0];
                                        return (
                                            <AutocompleteSelect
                                                {...(isTree
                                                    ? { entries: funcionarios as SubordinadoEntry[] }
                                                    : { items: funcionarios as LookupItem[] })}
                                                value={draft.funcionarioId}
                                                onChange={(v) => setDraft((d) => ({ ...d, funcionarioId: v }))}
                                                placeholder="funcionário"
                                                required
                                                disabled={viewOnly}
                                            />
                                        );
                                    })()}
                                    {myFuncId && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Exibindo subordinados diretos e indiretos da sua hierarquia.
                                        </p>
                                    )}
                                </div>

                                {/* 2. Empresa */}
                                <div>
                                    <label className={L}>Cód. Colaborador</label>
                                    <ReadonlyField value={atualCodColaborador} />
                                </div>
                                <div>
                                    <label className={L}>Cód. Empresa</label>
                                    <ReadonlyField value={atualEmpresaCodigo} />
                                </div>
                                <div>
                                    <label className={L}>Empresa</label>
                                    <ReadonlyField value={atualEmpresaNome} />
                                </div>

                                {/* 3. Estabelecimento */}
                                <div>
                                    <label className={L}>Cód. Estabelecimento</label>
                                    <ReadonlyField value={atualEstabelecimentoCodigo} />
                                </div>
                                <div className="col-span-2">
                                    <label className={L}>Estabelecimento (Local)</label>
                                    <ReadonlyField value={atualEstabelecimentoNome} />
                                </div>

                                {/* Cargo atual */}
                                <div>
                                    <label className={L}>Cargo Atual</label>
                                    <ReadonlyField value={atualCargo} />
                                </div>

                                <div className="col-span-2" />

                                {/* Histórico */}
                                <div className="col-span-3">
                                    <label className={L}>Histórico de Medidas Disciplinares?</label>
                                    <select
                                        className={S}
                                        value={draft.historicoMedidasDisciplinares === null ? "" : String(draft.historicoMedidasDisciplinares)}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setDraft((d) => ({
                                                ...d,
                                                historicoMedidasDisciplinares: v === "" ? null : v === "true",
                                            }));
                                        }}
                                        disabled={viewOnly}
                                    >
                                        <option value="">Não informado</option>
                                        <option value="true">Sim</option>
                                        <option value="false">Não</option>
                                    </select>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ══════════════ TAB 2 — Desligamento ══════════════ */}
                        <TabsContent value="desligamento">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3">

                                <div className="col-span-full">
                                    <div className="flex items-center gap-2 my-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Dados do Desligamento</span>
                                        <div className="flex-1 border-t border-border" />
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <label className={L}>Tipo de Desligamento</label>
                                    <select className={S} value={draft.tipoDesligamento} onChange={(e) => setDraft((d) => ({ ...d, tipoDesligamento: Number(e.target.value) }))} disabled={viewOnly}>
                                        <option value={0}>Sem Justa Causa</option>
                                        <option value={1}>Pedido de Demissão</option>
                                        <option value={2}>Acordo Mútuo</option>
                                        <option value={3}>Justa Causa</option>
                                        <option value={4}>Fim de Contrato</option>
                                    </select>
                                </div>

                                <div>
                                    <label className={L}>Data de Desligamento *</label>
                                    <Input type="date" value={draft.dataDesligamento} onChange={(e) => setDraft((d) => ({ ...d, dataDesligamento: e.target.value }))} disabled={viewOnly} />
                                </div>

                                <div>
                                    <label className={L}>Tipo de Aviso Prévio</label>
                                    <select className={S} value={draft.tipoAvisoPrevio} onChange={(e) => setDraft((d) => ({ ...d, tipoAvisoPrevio: Number(e.target.value) }))} disabled={viewOnly}>
                                        <option value={0}>Indenizado</option>
                                        <option value={1}>Trabalhado</option>
                                        <option value={2}>Dispensado</option>
                                    </select>
                                </div>

                                <div>
                                    <label className={L}>Dias de Aviso Prévio</label>
                                    <Input type="number" min={0} value={draft.diasAvisoPrevio} onChange={(e) => setDraft((d) => ({ ...d, diasAvisoPrevio: Math.max(0, Number(e.target.value)) }))} disabled={viewOnly} />
                                </div>

                                <div />

                                <div className="col-span-3">
                                    <label className={L}>Justificativa *</label>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground resize-none disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-default"
                                        rows={4}
                                        value={draft.motivoDesligamento}
                                        onChange={(e) => setDraft((d) => ({ ...d, motivoDesligamento: e.target.value }))}
                                        placeholder="Descreva o motivo do desligamento..."
                                        maxLength={2000}
                                        disabled={viewOnly}
                                    />
                                </div>

                                <div className="col-span-3 flex items-center gap-6 py-1">
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.possuiEstabilidade} onChange={(e) => setDraft((d) => ({ ...d, possuiEstabilidade: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">Possui estabilidade de emprego</span>
                                    </label>
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.elegivelRecontratacao} onChange={(e) => setDraft((d) => ({ ...d, elegivelRecontratacao: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">Elegível para recontratação</span>
                                    </label>
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.substituirPosicao} onChange={(e) => setDraft((d) => ({ ...d, substituirPosicao: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">Substituir posição após desligamento</span>
                                    </label>
                                </div>

                                <div className="col-span-3">
                                    <label className={L}>Observações</label>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground resize-none disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-default"
                                        rows={3}
                                        value={draft.observacoes}
                                        onChange={(e) => setDraft((d) => ({ ...d, observacoes: e.target.value }))}
                                        placeholder="Observações adicionais (opcional)..."
                                        maxLength={1000}
                                        disabled={viewOnly}
                                    />
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
                            <Button variant="outline" onClick={onClose} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button onClick={() => void save()} disabled={saving || loadingEdit}>
                                {saving ? "Enviando…" : resubmitAfterSave ? "Salvar e reenviar para aprovação" : editId ? "Salvar alterações" : "Criar solicitação"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
