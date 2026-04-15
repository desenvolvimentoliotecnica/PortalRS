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
import { findEmpresaByCdn, findUnitByEstabCode } from "@/lib/funcionarioLookupResolve";
import { type OrgEstruturaResponse, type SubordinadoEntry, getSubordinados, filterSubordinadoEntries } from "@/lib/organograma";

/* ──────────────────────────── types ──────────────────────────── */

interface LookupItem {
    id: string;
    name: string;
    code?: string;
    sublabel?: string;
}

interface PromocaoDraft {
    funcionarioId: string | null;
    dataEfetiva: string;
    novoCargoId: string | null;
    novaAreaId: string | null;
    novaUnidadeId: string | null;
    empresaId: string | null;
    unitId: string | null;
    centroCustoId: string | null;
    unidadeLotacaoId: string | null;
    motivoMovimentacao: number | null;
    novaLocalidade: string;
    novoSalario: string;
    novaPericulosidade: string;
    novaRemuneracao: string;
    horarioProposto: string;
    justificativa: string;
    observacoes: string;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
    viewOnly?: boolean;
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
    novaUnidadeId: null,
    empresaId: null,
    unitId: null,
    centroCustoId: null,
    unidadeLotacaoId: null,
    motivoMovimentacao: null,
    novaLocalidade: "",
    novoSalario: "",
    novaPericulosidade: "",
    novaRemuneracao: "",
    horarioProposto: "",
    justificativa: "",
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
    if (disabled) {
        const selectedName = entries
            ? (entries.find((e) => e.id === value)?.name ?? "")
            : (() => { const s = items?.find((i) => i.id === value); return s ? (s.code ? `${s.code} – ${s.name}` : s.name) : ""; })();
        return <ReadonlyField value={selectedName} />;
    }
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedName = entries
        ? (entries.find((e) => e.id === value)?.name ?? "")
        : (() => { const s = items?.find((i) => i.id === value); return s ? (s.code ? `${s.code} – ${s.name}` : s.name) : ""; })();

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

    // Tree mode (entries)
    if (entries) {
        const filtered = filterSubordinadoEntries(entries, query);

        return (
            <div ref={containerRef} className="relative">
                <div className="flex gap-1">
                    <input
                        className={`h-9 flex-1 rounded-md border px-3 text-sm bg-background ${required && !value ? "border-red-400" : "border-input"}`}
                        placeholder={`Buscar ${placeholder}...`}
                        value={open ? query : selectedName}
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
                    value={open ? query : selectedName}
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

/* ──────────────────────────── ReadonlyField ──────────────────────────── */

function ReadonlyField({ value }: { value?: string }) {
    return (
        <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
            {value || <span className="italic opacity-40">—</span>}
        </div>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function PromocaoFormModal({ open, editId, onClose, onSaved, viewOnly }: Props) {
    const [draft, setDraft] = useState<PromocaoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState("identificacao");

    /* ── lookups ── */
    const [funcionarios, setFuncionarios] = useState<SubordinadoEntry[] | LookupItem[]>([]);
    const [cargos, setCargos] = useState<LookupItem[]>([]);
    const [areas, setAreas] = useState<LookupItem[]>([]);
    const [unidades, setUnidades] = useState<LookupItem[]>([]);
    const [empresas, setEmpresas] = useState<LookupItem[]>([]);

    /* ── contexto do usuário logado ── */
    const [myFuncId, setMyFuncId] = useState<string | null>(null);

    /* ── situação ATUAL do funcionário (auto-preenchida) ── */
    const [atualCargo, setAtualCargo] = useState("");
    const [atualArea, setAtualArea] = useState("");
    const [atualUnidade, setAtualUnidade] = useState("");

    /* ── campos bloqueados auto-preenchidos do funcionário ── */
    const [atualCodColaborador, setAtualCodColaborador] = useState("");
    const [atualEmpresaCodigo, setAtualEmpresaCodigo] = useState("");
    const [atualEmpresaNome, setAtualEmpresaNome] = useState("");
    const [atualEstabelecimentoCodigo, setAtualEstabelecimentoCodigo] = useState("");
    const [atualEstabelecimentoNome, setAtualEstabelecimentoNome] = useState("");
    const [atualCCNome, setAtualCCNome] = useState("");
    const [atualLotacaoNome, setAtualLotacaoNome] = useState("");

    const loadLookups = useCallback(async () => {
        type OptionRes = { id: string; name: string; code?: string };
        const [funcsRes, cargosRes, areasRes, unidadesRes, empresasRes, meRes, orgRes] = await Promise.all([
            fetchJson<Record<string, unknown>>("/api/lookup/funcionarios?pageSize=500").catch(() => ({ items: [] })),
            fetchJson<OptionRes[]>("/api/lookup/job-positions").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/areas").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/units").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/empresas").catch(() => []),
            fetchJson<{ funcionarioId?: string }>("/api/me").catch(() => ({} as { funcionarioId?: string })),
            fetchJson<OrgEstruturaResponse>("/api/organograma/estrutura").catch(() => ({ lotacoes: [], semLotacao: [] })),
        ]);

        const empresasArr: LookupItem[] = Array.isArray(empresasRes) ? empresasRes : [];
        setEmpresas(empresasArr);
        setCargos(Array.isArray(cargosRes) ? cargosRes : []);
        setAreas(Array.isArray(areasRes) ? areasRes : []);
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
            setAtualCargo(""); setAtualArea(""); setAtualUnidade("");
            setAtualEmpresaCodigo(""); setAtualEmpresaNome("");
            setAtualEstabelecimentoCodigo(""); setAtualEstabelecimentoNome("");
            setAtualCCNome(""); setAtualLotacaoNome("");
            setDraft((d) => ({ ...d, empresaId: null, unitId: null, centroCustoId: null, unidadeLotacaoId: null }));
            return;
        }
        fetchJson<Record<string, unknown>>(`/api/funcionarios/${draft.funcionarioId}`)
            .then((f) => {
                setAtualCodColaborador(f?.cdnFuncionario ? String(f.cdnFuncionario) : "");
                setAtualCargo(String(f?.jobPositionName ?? "—"));
                setAtualArea(String(f?.areaName ?? "—"));
                setAtualUnidade(String(f?.unitName ?? "—"));

                /* empresa: match pelo código TOTVS (CdnEmpresa → Empresa.Code) */
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
                const estabelecimentoNome = unitNameApi || unitMatch?.name || "";
                setAtualEstabelecimentoNome(estabelecimentoNome);

                setAtualCCNome(String(f?.centroCustoDescricao ?? f?.centroCustoNome ?? ""));
                setAtualLotacaoNome(String(f?.unidadeLotacaoDescricao ?? ""));

                setDraft((d) => ({
                    ...d,
                    empresaId: empresaMatch?.id ?? null,
                    unitId: resolvedUnitId,
                    centroCustoId: f?.centroCustoId ? String(f.centroCustoId) : null,
                    unidadeLotacaoId: f?.unidadeLotacaoId ? String(f.unidadeLotacaoId) : null,
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
                    setDraft({
                        funcionarioId: d?.funcionarioId ? String(d.funcionarioId) : null,
                        dataEfetiva: d?.dataEfetiva ? String(d.dataEfetiva).slice(0, 10) : "",
                        novoCargoId: d?.novoCargoId ? String(d.novoCargoId) : null,
                        novaAreaId: d?.novaAreaId ? String(d.novaAreaId) : null,
                        novaUnidadeId: d?.novaUnidadeId ? String(d.novaUnidadeId) : null,
                        empresaId: d?.empresaId ? String(d.empresaId) : null,
                        unitId: d?.unitId ? String(d.unitId) : null,
                        centroCustoId: d?.centroCustoId ? String(d.centroCustoId) : null,
                        unidadeLotacaoId: d?.unidadeLotacaoId ? String(d.unidadeLotacaoId) : null,
                        motivoMovimentacao: d?.motivoMovimentacao != null ? Number(d.motivoMovimentacao) : null,
                        novaLocalidade: String(d?.novaLocalidade ?? ""),
                        novoSalario: d?.novoSalario != null ? String(d.novoSalario) : "",
                        novaPericulosidade: String(d?.novaPericulosidade ?? ""),
                        novaRemuneracao: d?.novaRemuneracao != null ? String(d.novaRemuneracao) : "",
                        horarioProposto: String(d?.horarioProposto ?? ""),
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
        const errors: string[] = [];
        if (!draft.funcionarioId) errors.push("Funcionário");
        if (!draft.dataEfetiva) errors.push("Data Efetiva");
        if (!draft.empresaId) errors.push("Empresa (código da empresa do funcionário não bate com o cadastro)");
        if (!draft.unitId) errors.push("Estabelecimento (código do estabelecimento sem unidade correspondente no portal)");
        if (!draft.unidadeLotacaoId) errors.push("Lotação (cadastro do funcionário sem lotação)");
        if (draft.motivoMovimentacao === null) errors.push("Motivo da Movimentação");
        if (!draft.novoCargoId) errors.push("Novo Cargo");
        if (!draft.justificativa.trim()) errors.push("Justificativa");

        if (errors.length > 0) {
            toast.error(`Campos obrigatórios: ${errors.join(", ")}.`);
            return;
        }

        setSaving(true);
        const payload = {
            funcionarioId: draft.funcionarioId,
            dataEfetiva: draft.dataEfetiva,
            novoCargoId: draft.novoCargoId,
            novaAreaId: draft.novaAreaId || null,
            novaUnidadeId: draft.novaUnidadeId || null,
            empresaId: draft.empresaId,
            unitId: draft.unitId,
            centroCustoId: draft.centroCustoId || null,
            unidadeLotacaoId: draft.unidadeLotacaoId,
            motivoMovimentacao: draft.motivoMovimentacao,
            novaLocalidade: draft.novaLocalidade.trim() || null,
            novoSalario: draft.novoSalario ? parseFloat(draft.novoSalario) : null,
            novaPericulosidade: draft.novaPericulosidade.trim() || null,
            novaRemuneracao: draft.novaRemuneracao ? parseFloat(draft.novaRemuneracao) : null,
            horarioProposto: draft.horarioProposto.trim() || null,
            justificativa: draft.justificativa.trim(),
            observacoes: draft.observacoes.trim() || null,
        };

        try {
            if (editId) {
                await fetchJson(`${API}/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Solicitação atualizada.");
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

    /* helpers de exibição */
    const L = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1";

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {viewOnly ? "Visualizar Movimentação de Pessoal" : editId ? "Editar Movimentação de Pessoal" : "Movimentação de Pessoal"}
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
                            <TabsTrigger value="funcionario">Informações do Funcionário</TabsTrigger>
                            <TabsTrigger value="horario">Horário</TabsTrigger>
                            <TabsTrigger value="complemento">Complemento</TabsTrigger>
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

                                {/* 4. Data Efetiva */}
                                <div>
                                    <label className={L}>Data Efetiva *</label>
                                    <Input type="date" value={draft.dataEfetiva} onChange={(e) => setDraft((d) => ({ ...d, dataEfetiva: e.target.value }))} disabled={viewOnly} />
                                </div>

                                <div className="col-span-2" />

                                {/* 5. Centro de Custo — read-only */}
                                <div className="col-span-2">
                                    <label className={L}>Centro de Custo</label>
                                    <ReadonlyField value={atualCCNome} />
                                </div>

                                <div />

                                {/* 6. Lotação — read-only */}
                                <div className="col-span-2">
                                    <label className={L}>Lotação</label>
                                    <ReadonlyField value={atualLotacaoNome} />
                                </div>

                                <div />

                                {/* 7. Motivo */}
                                <div className="col-span-3">
                                    <label className={L}>Motivo da Movimentação *</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-default"
                                        value={draft.motivoMovimentacao ?? ""}
                                        onChange={(e) => setDraft((d) => ({ ...d, motivoMovimentacao: e.target.value !== "" ? Number(e.target.value) : null }))}
                                        disabled={viewOnly}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value={0}>Mérito</option>
                                        <option value={1}>Promoção</option>
                                        <option value={2}>Reclassificação de Cargo</option>
                                        <option value={3}>Transferência C. Custo</option>
                                        <option value={4}>Promoção + Transferência de Base</option>
                                        <option value={5}>Outros</option>
                                    </select>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ══════════════ TAB 2 — Informações do Funcionário ══════════════ */}
                        <TabsContent value="funcionario">
                            <div className="rounded-md border border-border overflow-hidden">
                                {/* cabeçalho das colunas */}
                                <div className="grid grid-cols-2 bg-muted/60">
                                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-r border-border">
                                        Situação Atual
                                    </div>
                                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Situação Nova
                                    </div>
                                </div>

                                {/* linhas de comparação */}
                                {[
                                    {
                                        label: "Empresa",
                                        atual: <ReadonlyField value={atualEmpresaNome} />,
                                        nova: <ReadonlyField value={atualEmpresaNome} />,
                                    },
                                    {
                                        label: "Localidade (Estabelecimento)",
                                        atual: <ReadonlyField value={atualUnidade} />,
                                        nova: <AutocompleteSelect items={unidades} value={draft.novaUnidadeId} onChange={(v) => setDraft((d) => ({ ...d, novaUnidadeId: v }))} placeholder="estabelecimento" disabled={viewOnly} />,
                                        novaLabel: "Novo Local (Transferência)",
                                    },
                                    {
                                        label: "Cargo",
                                        atual: <ReadonlyField value={atualCargo} />,
                                        nova: <AutocompleteSelect items={cargos} value={draft.novoCargoId} onChange={(v) => setDraft((d) => ({ ...d, novoCargoId: v }))} placeholder="cargo" required disabled={viewOnly} />,
                                        novaLabel: "Novo Cargo *",
                                    },
                                    {
                                        label: "Salário",
                                        atual: <ReadonlyField />,
                                        nova: (
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={draft.novoSalario}
                                                onChange={(e) => setDraft((d) => ({ ...d, novoSalario: e.target.value }))}
                                                placeholder="R$ 0,00"
                                                disabled={viewOnly}
                                            />
                                        ),
                                        novaLabel: "Novo Salário",
                                    },
                                    {
                                        label: "Periculosidade",
                                        atual: <ReadonlyField />,
                                        nova: (
                                            <Input
                                                value={draft.novaPericulosidade}
                                                onChange={(e) => setDraft((d) => ({ ...d, novaPericulosidade: e.target.value }))}
                                                placeholder="Ex: 30%, Sim, Não..."
                                                maxLength={60}
                                                disabled={viewOnly}
                                            />
                                        ),
                                        novaLabel: "Nova Periculosidade",
                                    },
                                    {
                                        label: "Remuneração",
                                        atual: <ReadonlyField />,
                                        nova: (
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={draft.novaRemuneracao}
                                                onChange={(e) => setDraft((d) => ({ ...d, novaRemuneracao: e.target.value }))}
                                                placeholder="R$ 0,00"
                                                disabled={viewOnly}
                                            />
                                        ),
                                        novaLabel: "Nova Remuneração",
                                    },
                                    {
                                        label: "Centro de Custo",
                                        atual: <ReadonlyField />,
                                        nova: <ReadonlyField value={atualCCNome} />,
                                    },
                                    {
                                        label: "Lotação",
                                        atual: <ReadonlyField />,
                                        nova: <ReadonlyField value={atualLotacaoNome} />,
                                    },
                                ].map(({ label, atual, nova, novaLabel }, i) => (
                                    <div key={label} className={`grid grid-cols-2 border-t border-border ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                                        <div className="px-4 py-2 border-r border-border">
                                            <p className={L}>{label}</p>
                                            {atual}
                                        </div>
                                        <div className="px-4 py-2">
                                            <p className={L}>{novaLabel ?? label}</p>
                                            {nova}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Impacto na Folha — fora da tabela, readonly */}
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                    <label className={L}>Impacto na Folha Atual</label>
                                    <ReadonlyField />
                                </div>
                                <div>
                                    <label className={L}>Impacto na Folha Nova</label>
                                    <ReadonlyField />
                                </div>
                            </div>

                        </TabsContent>

                        {/* ══════════════ TAB 3 — Horário ══════════════ */}
                        <TabsContent value="horario">
                            <div className="space-y-5">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Horário Atual</span>
                                        <div className="flex-1 border-t border-border" />
                                    </div>
                                    <HorarioEditor value="" readonly />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Horário Proposto</span>
                                        <div className="flex-1 border-t border-border" />
                                    </div>
                                    <HorarioEditor
                                        value={draft.horarioProposto}
                                        onChange={(v) => setDraft((d) => ({ ...d, horarioProposto: v }))}
                                        readonly={viewOnly}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* ══════════════ TAB 4 — Complemento ══════════════ */}
                        <TabsContent value="complemento">
                            <div className="grid grid-cols-1 gap-y-4">

                                <div className="flex items-center gap-2 mb-1 mt-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Justificativa</span>
                                    <div className="flex-1 border-t border-border" />
                                </div>

                                <div>
                                    <label className={L}>Justificativa *</label>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground resize-none disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-default"
                                        rows={4}
                                        value={draft.justificativa}
                                        onChange={(e) => setDraft((d) => ({ ...d, justificativa: e.target.value }))}
                                        placeholder="Justifique a movimentação do funcionário..."
                                        maxLength={2000}
                                        disabled={viewOnly}
                                    />
                                </div>

                                <div>
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
                            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                            <Button onClick={() => void save()} disabled={saving || loadingEdit}>
                                {saving ? "Enviando…" : editId ? "Salvar alterações" : "Solicitar aprovação"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
