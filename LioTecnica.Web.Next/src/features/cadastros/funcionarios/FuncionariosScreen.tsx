"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, RefreshCw, Trash2, Eye, Download, Upload, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown, X, UserCircle, Pencil } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import { getScreenCache, setScreenCache } from "@/lib/screenCache";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportGuide } from "@/components/ImportGuide";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import PaginationBar from "@/components/pagination/PaginationBar";



/* ---------- types ---------- */
interface EntityChangeListItem {
    id: string;
    occurredAt: string;
    state: string;
    entityName: string;
    userName: string | null;
    changedColumns: string | null;
}

interface MovimentacaoItem {
    id: string;
    funcionarioId: string | null;
    chapaRm: string;
    idReqRm: string;
    tipoMovimentacao: number;
    tipoDescricao: string | null;
    dataAbertura: string;
    dataConclusao: string | null;
    codStatus: number;
    statusDescricao: string | null;
    codFuncaoOrigem: string | null;
    codFuncaoDestino: string | null;
    codSecaoOrigem: string | null;
    codSecaoDestino: string | null;
    salarioOrigem: number | null;
    salarioDestino: number | null;
    gerouSubstituicao: boolean | null;
}

type TimelineEvent =
    | { kind: "audit"; key: string; occurredAt: string; data: EntityChangeListItem }
    | { kind: "movimentacao"; key: string; occurredAt: string; data: MovimentacaoItem }
    | { kind: "admissao"; key: string; occurredAt: string; dataAdmissao: string };

interface FuncItem {
    id: string;
    nome: string;
    email?: string;
    telefone?: string;
    status: string;
    headcount?: number;
    unidade: string;
    unidadeId?: string;
    centroCustoNome: string;
    centroCustoId?: string;
    cargo: string;
    cargoId?: string;
    nivelHierarquicoNome?: string;
    centroCustoDescricao?: string;
    pessoaId?: string;
    hasIncompleteData: boolean;
    unidadeLotacaoCode?: string;
    centroCustoCode?: string;
    // TOTVS Datasul
    cdnFuncionario?: string;
    cdnEmpresa?: string;
    cdnEstab?: string;
    // TOTVS RM (refactor 2026-04-26)
    matriculaRm?: string;
    hierarquiaId?: string;
    hierarquiaDescricao?: string;
    codSituacaoRm?: string;
    situacaoRmDescricao?: string;
}

interface FuncDetail {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status: string;
    headcount: number;
    unitId?: string;
    unitName?: string;
    areaId?: string;
    areaName?: string;
    jobPositionId?: string;
    jobPositionName?: string;
    jobPositionCode?: string;
    requisitoCategoriaId?: string;
    requisitoCategoriaName?: string;
    notes?: string;
    createdAtUtc: string;
    updatedAtUtc: string;
    // Hierarquia
    gestorDiretoId?: string;
    gestorDiretoNome?: string;
    nivelHierarquicoId?: string;
    nivelHierarquicoNome?: string;
    // Lotação TOTVS
    unidadeLotacaoId?: string;
    unidadeLotacaoDescricao?: string;
    unidadeLotacaoCode?: string;
    centroCustoId?: string;
    centroCustoDescricao?: string;
    centroCustoCode?: string;
    // Chaves TOTVS
    cdnFuncionario?: string;
    cdnEmpresa?: string;
    cdnEstab?: string;
    // Dados pessoais
    dataAdmissao?: string;
    dataNascimento?: string;
    sexo?: string;
    // TOTVS RM (LUC-122) — usado pra detectar origem RM e suprimir validações Datasul
    matriculaRm?: string;
    hierarquiaId?: string;
    hierarquiaDescricao?: string;
    codSituacaoRm?: string;
    situacaoRmDescricao?: string;
}

interface LookupOption { id: string; label: string; }
interface EditForm {
    name: string;
    email: string;
    phone: string;
    status: string;
    headcount: number;
    // org
    unitId: string; unitLabel: string;
    areaId: string; areaLabel: string;
    jobPositionId: string; jobPositionLabel: string;
    requisitoCategoriaId: string; requisitoCategoriaLabel: string;
    // hierarquia
    gestorDiretoId: string; gestorDiretoLabel: string;
    nivelHierarquicoId: string; nivelHierarquicoLabel: string;
    // lotação
    unidadeLotacaoId: string; unidadeLotacaoLabel: string;
    centroCustoId: string; centroCustoLabel: string;
    // totvs
    cdnFuncionario: string;
    cdnEmpresa: string;
    cdnEstab: string;
    // pessoal
    dataAdmissao: string;
    dataNascimento: string;
    sexo: string;
    notes: string;
}

interface ImportRow {
    cdnFuncionario: string;
    cdnEmpresa: string;
    cdnEstab: string;
    nome: string;
    email: string;
    cpf: string;
    dataNascimento: string;
    rg: string;
    fone: string;
    cep: string;
    logradouro: string;
    numeroEndereco: string;
    bairro: string;
    cidade: string;
    uf: string;
    codUnidLotac: string;
    cdnPlanoLotac: string;
    dataInicCargo: string;
    codCargo: string;
    codCentroCusto: string;
    codNivCargo: string;
}

interface FuncListPayload {
    items: Record<string, unknown>[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

/* ---------- helpers ---------- */
async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    }, timeoutMs);
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        const msg = `HTTP ${res.status}: ${t || res.statusText}`;
        console.error(`[apiFetch] ${init?.method ?? "GET"} ${url} → ${msg}`);
        throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function missingFieldsTooltip(f: FuncItem): string {
    const missing: string[] = [];
    if (!f.nome?.trim()) missing.push("Nome");
    if (!f.pessoaId) missing.push("Cadastro (Pessoa)");
    if (!f.cargoId) missing.push("Cargo");
    if (!f.unidadeId) missing.push("Unidade de Lotação");
    if (!f.nivelHierarquicoNome) missing.push("Nível do Cargo");
    if (!f.centroCustoDescricao) missing.push("Centro de Custo");
    return missing.length ? `Campos faltantes: ${missing.join(", ")}` : "";
}

function statusBadge(s: string | null | undefined) {
    const st = (s ?? "").toLowerCase();
    if (st === "ativo" || st === "active")
        return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>;
    return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>;
}

function stateLabel(state: string | null | undefined) {
    const s = (state ?? "").toLowerCase();
    if (s === "added") return "Criado";
    if (s === "modified") return "Alterado";
    if (s === "deleted") return "Removido";
    return state || "—";
}

function fmt(iso: string | undefined) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
    catch { return iso; }
}

const PAGE_SIZES = [10, 20, 50, 100];

/* ---------- FilterAutocomplete ---------- */
function FilterAutocomplete({
    fetchOptions,
    value,
    onChange,
    placeholder,
    initialLabel,
}: {
    fetchOptions: (search: string) => Promise<{ id: string; label: string }[]>;
    value: string;
    onChange: (id: string, label: string) => void;
    placeholder: string;
    initialLabel?: string;
}) {
    const [inputValue, setInputValue] = useState("");
    const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
    const [open, setOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState(initialLabel ?? "");
    const containerRef = useRef<HTMLDivElement>(null);

    // Load options on mount (empty search = first 50 sorted by code)
    useEffect(() => {
        fetchOptions("").then(setOptions).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced server-side search on each keystroke
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => {
            fetchOptions(inputValue).then(setOptions).catch(() => {});
        }, 250);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputValue, open]);

    // Sync when value+initialLabel change together (e.g. opening a different record)
    useEffect(() => {
        if (!value) setSelectedLabel("");
        else if (initialLabel) setSelectedLabel(initialLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, initialLabel]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setInputValue("");
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    function select(o: { id: string; label: string }) {
        onChange(o.id, o.label);
        setSelectedLabel(o.label);
        setInputValue("");
        setOpen(false);
    }

    function clear() {
        onChange("", "");
        setSelectedLabel("");
        setInputValue("");
        setOpen(false);
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="flex h-9 items-center rounded-md border border-input bg-background text-sm overflow-hidden">
                {value ? (
                    <>
                        <span className="flex-1 truncate px-3 text-sm">{selectedLabel}</span>
                        <button type="button" onClick={clear} className="px-2 text-muted-foreground hover:text-foreground flex-shrink-0">
                            <X className="size-3" />
                        </button>
                    </>
                ) : (
                    <input
                        className="flex-1 min-w-0 px-3 bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder={placeholder}
                        value={inputValue}
                        onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                    />
                )}
            </div>
            {open && options.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-full min-w-[220px] overflow-auto rounded-md border border-border bg-popover shadow-md">
                    {options.map((o) => (
                        <div
                            key={o.id}
                            className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
                            onMouseDown={(e) => { e.preventDefault(); select(o); }}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ---------- component ---------- */
export default function FuncionariosScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<FuncItem[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [lotacaoFilter, setLotacaoFilter] = useState("");
    const [centroCustoFilter, setCentroCustoFilter] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<FuncItem | null>(null);

    const [detailId, setDetailId] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<FuncDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState<"dados" | "editar" | "historico">("dados");
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyItems, setHistoryItems] = useState<EntityChangeListItem[]>([]);
    const [movimentacoesItems, setMovimentacoesItems] = useState<MovimentacaoItem[]>([]);

    const EMPTY_EDIT_FORM: EditForm = { name: "", email: "", phone: "", status: "Active", headcount: 1, unitId: "", unitLabel: "", areaId: "", areaLabel: "", jobPositionId: "", jobPositionLabel: "", requisitoCategoriaId: "", requisitoCategoriaLabel: "", gestorDiretoId: "", gestorDiretoLabel: "", nivelHierarquicoId: "", nivelHierarquicoLabel: "", unidadeLotacaoId: "", unidadeLotacaoLabel: "", centroCustoId: "", centroCustoLabel: "", cdnFuncionario: "", cdnEmpresa: "", cdnEstab: "", dataAdmissao: "", dataNascimento: "", sexo: "", notes: "" };
    const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
    const [editOptions, setEditOptions] = useState<{ units: LookupOption[]; areas: LookupOption[]; jobPositions: LookupOption[]; nivelHierarquicos: LookupOption[]; requisitoCategorias: LookupOption[] } | null>(null);
    const [editOptionsLoading, setEditOptionsLoading] = useState(false);
    const [editSaving, setEditSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importRows, setImportRows] = useState<ImportRow[]>([]);
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number; warnings: string[] } | null>(null);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [sort, setSort] = useState("funcionario");
    const [dir, setDir] = useState("asc");

    // Abre detalhe via evento customizado (quando já na tela) ou sessionStorage (ao navegar até ela)
    useEffect(() => {
        const pending = sessionStorage.getItem("renderrh.pendingFuncionarioDetail");
        if (pending) {
            sessionStorage.removeItem("renderrh.pendingFuncionarioDetail");
            void openDetail(pending);
        }

        const handler = (e: Event) => {
            const id = (e as CustomEvent<{ id: string }>).detail?.id;
            if (id) void openDetail(id);
        };
        window.addEventListener("renderrh:openFuncionario", handler);
        return () => window.removeEventListener("renderrh:openFuncionario", handler);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const syncList = useCallback(async (opts: { page: number; pageSize: number; search?: string; status?: string; sort?: string; dir?: string; lotacao?: string; centroCusto?: string }) => {
        const nextPage = opts.page;
        const nextPageSize = opts.pageSize;
        const nextSearch = (opts.search ?? "").trim();
        const nextStatus = opts.status ?? "all";
        const params = new URLSearchParams({
            page: String(nextPage),
            pageSize: String(nextPageSize),
        });
        if (nextSearch) params.set("search", nextSearch);
        if (nextStatus === "ativo") params.set("status", "Active");
        if (nextStatus === "inativo") params.set("status", "Inactive");
        if (nextStatus === "com_erro") params.set("hasMissingData", "true");
        if (opts.sort) params.set("sort", opts.sort);
        if (opts.dir) params.set("dir", opts.dir);
        if (opts.lotacao) params.set("unidadeLotacaoId", opts.lotacao);
        if (opts.centroCusto) params.set("centroCustoId", opts.centroCusto);
        const payload = await fetchJson<FuncListPayload>(`/api/funcionarios?${params.toString()}`);
        const mapped: FuncItem[] = (Array.isArray(payload?.items) ? payload.items : []).map((i) => ({
            id: String(i.id ?? ""),
            nome: String(i.name ?? ""),
            email: i.email ? String(i.email) : undefined,
            telefone: i.phone ? String(i.phone) : undefined,
            status: String(i.status ?? ""),
            headcount: typeof i.headcount === "number" ? i.headcount : 0,
            unidade: String(i.unidadeLotacaoDescricao ?? i.unitName ?? ""),
            unidadeId: i.unidadeLotacaoId ? String(i.unidadeLotacaoId) : (i.unitId ? String(i.unitId) : undefined),
            centroCustoNome: String(i.centroCustoDescricao ?? i.centroCustoName ?? ""),
            centroCustoId: i.centroCustoId ? String(i.centroCustoId) : undefined,
            cargo: String(i.jobPositionName ?? ""),
            cargoId: i.jobPositionId ? String(i.jobPositionId) : undefined,
            nivelHierarquicoNome: i.nivelHierarquicoNome ? String(i.nivelHierarquicoNome) : undefined,
            centroCustoDescricao: i.centroCustoDescricao ? String(i.centroCustoDescricao) : undefined,
            unidadeLotacaoCode: i.unidadeLotacaoCode ? String(i.unidadeLotacaoCode) : undefined,
            centroCustoCode: i.centroCustoCode ? String(i.centroCustoCode) : undefined,
            pessoaId: i.pessoaId ? String(i.pessoaId) : undefined,
            hasIncompleteData: Boolean(i.hasIncompleteData),
            cdnFuncionario: i.cdnFuncionario ? String(i.cdnFuncionario) : undefined,
            cdnEmpresa: i.cdnEmpresa ? String(i.cdnEmpresa) : undefined,
            cdnEstab: i.cdnEstab ? String(i.cdnEstab) : undefined,
            // TOTVS RM
            matriculaRm: i.matriculaRm ? String(i.matriculaRm) : undefined,
            hierarquiaId: i.hierarquiaId ? String(i.hierarquiaId) : undefined,
            hierarquiaDescricao: i.hierarquiaDescricao ? String(i.hierarquiaDescricao) : undefined,
            codSituacaoRm: i.codSituacaoRm ? String(i.codSituacaoRm) : undefined,
            situacaoRmDescricao: i.situacaoRmDescricao ? String(i.situacaoRmDescricao) : undefined,
        }));
        setRows(mapped);
        setScreenCache("/funcionarios", mapped);
        setPage(typeof payload?.page === "number" && payload.page > 0 ? payload.page : nextPage);
        setPageSize(typeof payload?.pageSize === "number" && payload.pageSize > 0 ? payload.pageSize : nextPageSize);
        setTotalItems(typeof payload?.totalItems === "number" && payload.totalItems >= 0 ? payload.totalItems : 0);
        setTotalPages(typeof payload?.totalPages === "number" && payload.totalPages > 0 ? payload.totalPages : 1);
    }, []);

    useEffect(() => {
        let alive = true;
        const cached = getScreenCache<FuncItem[]>("/funcionarios");
        if (cached && Array.isArray(cached)) {
            setRows(cached);
        } else {
            setLoading(true);
        }
        syncList({ page: 1, pageSize, search: q, status: statusFilter })
            .catch((e) => { console.error("Funcionários – load error", e); toast.error(`Falha ao carregar: ${e instanceof Error ? e.message : "erro"}`); })
            .finally(() => { if (alive) setLoading(false); });

        return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncList]);

    useEffect(() => {
        const id = setTimeout(() => {
            setLoading(true);
            syncList({ page: 1, pageSize, search: q, status: statusFilter, sort, dir, lotacao: lotacaoFilter, centroCusto: centroCustoFilter })
                .catch((e) => {
                    console.error("Funcionários – filter load error", e);
                    toast.error(`Falha ao aplicar filtros: ${e instanceof Error ? e.message : "erro"}`);
                })
                .finally(() => setLoading(false));
        }, 350);
        return () => clearTimeout(id);
    }, [q, statusFilter, lotacaoFilter, centroCustoFilter, pageSize, sort, dir, syncList]);

    /* KPIs */
    const kpis = useMemo(() => {
        const total = totalItems;
        const active = rows.filter((f) => ["ativo", "active"].includes((f.status ?? "").toLowerCase())).length;
        const headcount = rows.reduce((s, f) => s + (f.headcount ?? 0), 0);
        const uniqueUnidades = new Set(rows.map((f) => f.unidade).filter(Boolean)).size;
        return { total, active, headcount, uniqueUnidades };
    }, [rows, totalItems]);

    /* Filter option loaders */
    const fetchLotacaoOptions = useCallback(async (search: string) => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const items = await fetchJson<{ id: string; displayLabel: string }[]>(`/api/unidades-lotacao/lookup?${params}`);
        return Array.isArray(items) ? items.map((o) => ({ id: String(o.id), label: o.displayLabel ?? "" })) : [];
    }, []);

    const fetchCentroCustoOptions = useCallback(async (search: string) => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const items = await fetchJson<{ id: string; displayLabel: string }[]>(`/api/centros-custo/lookup?${params}`);
        return Array.isArray(items) ? items.map((o) => ({ id: String(o.id), label: o.displayLabel ?? "" })) : [];
    }, []);

    /* Edit form autocomplete callbacks */
    const fetchEditUnits = useCallback(async (search: string) => {
        const opts = editOptions?.units ?? [];
        const lower = search.toLowerCase();
        return lower ? opts.filter((o) => o.label.toLowerCase().includes(lower)) : opts;
    }, [editOptions?.units]);

    const fetchEditAreas = useCallback(async (search: string) => {
        const opts = editOptions?.areas ?? [];
        const lower = search.toLowerCase();
        return lower ? opts.filter((o) => o.label.toLowerCase().includes(lower)) : opts;
    }, [editOptions?.areas]);

    const fetchEditJobPositions = useCallback(async (search: string) => {
        const opts = editOptions?.jobPositions ?? [];
        const lower = search.toLowerCase();
        return lower ? opts.filter((o) => o.label.toLowerCase().includes(lower)) : opts;
    }, [editOptions?.jobPositions]);

    const fetchEditRequisitoCategorias = useCallback(async (search: string) => {
        const opts = editOptions?.requisitoCategorias ?? [];
        const lower = search.toLowerCase();
        return lower ? opts.filter((o) => o.label.toLowerCase().includes(lower)) : opts;
    }, [editOptions?.requisitoCategorias]);

    const fetchEditNivelHierarquico = useCallback(async (search: string) => {
        const opts = editOptions?.nivelHierarquicos ?? [];
        const lower = search.toLowerCase();
        return lower ? opts.filter((o) => o.label.toLowerCase().includes(lower)) : opts;
    }, [editOptions?.nivelHierarquicos]);

    const fetchEditGestorDireto = useCallback(async (search: string) => {
        const params = new URLSearchParams({ onlyActive: "true", pageSize: "30" });
        if (search) params.set("q", search);
        const res = await fetchJson<{ items?: { id: string; nome: string }[] }>(`/api/lookup/funcionarios?${params}`);
        return (res?.items ?? []).map((o) => ({ id: String(o.id), label: o.nome }));
    }, []);

    const fetchEditUnidadeLotacao = useCallback(async (search: string) => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const items = await fetchJson<{ id: string; displayLabel: string }[]>(`/api/unidades-lotacao/lookup?${params}`);
        return Array.isArray(items) ? items.map((o) => ({ id: String(o.id), label: o.displayLabel ?? "" })) : [];
    }, []);

    const fetchEditCentroCusto = useCallback(async (search: string) => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const items = await fetchJson<{ id: string; displayLabel: string }[]>(`/api/centros-custo/lookup?${params}`);
        return Array.isArray(items) ? items.map((o) => ({ id: String(o.id), label: o.displayLabel ?? "" })) : [];
    }, []);

    /* Detail */
    async function loadDetailHistory(id: string) {
        setHistoryLoading(true);
        setHistoryItems([]);
        setMovimentacoesItems([]);
        try {
            const qs = new URLSearchParams({ entityName: "Funcionario", entityId: id, page: "1", pageSize: "50" });
            const [auditRes, movRes] = await Promise.all([
                apiFetch(`/api/audit/entity-changes?${qs.toString()}`).catch(() => null),
                apiFetch(`/api/funcionarios/${id}/movimentacoes`).catch(() => null),
            ]);

            if (auditRes?.ok) {
                const payload = await auditRes.json() as Record<string, unknown>;
                const list = Array.isArray(payload?.items) ? (payload.items as EntityChangeListItem[]) : [];
                setHistoryItems(list);
            }

            if (movRes?.ok) {
                const list = await movRes.json() as MovimentacaoItem[];
                setMovimentacoesItems(Array.isArray(list) ? list : []);
            }
        } catch { /* ignora — UI mostra "nenhuma alteração" */ }
        finally { setHistoryLoading(false); }
    }

    function mapFuncDetail(d: Record<string, unknown>, id: string): FuncDetail {
        return {
            id: String(d.id ?? id),
            name: String(d.name ?? ""),
            email: d.email ? String(d.email) : undefined,
            phone: d.phone ? String(d.phone) : undefined,
            status: String(d.status ?? ""),
            headcount: typeof d.headcount === "number" ? d.headcount : 0,
            unitId: d.unitId ? String(d.unitId) : undefined,
            unitName: d.unitName ? String(d.unitName) : undefined,
            areaId: d.areaId ? String(d.areaId) : undefined,
            areaName: d.areaName ? String(d.areaName) : undefined,
            jobPositionId: d.jobPositionId ? String(d.jobPositionId) : undefined,
            jobPositionName: d.jobPositionName ? String(d.jobPositionName) : undefined,
            jobPositionCode: d.jobPositionCode ? String(d.jobPositionCode) : undefined,
            requisitoCategoriaId: d.requisitoCategoriaId ? String(d.requisitoCategoriaId) : undefined,
            requisitoCategoriaName: d.requisitoCategoriaName ? String(d.requisitoCategoriaName) : undefined,
            notes: d.notes ? String(d.notes) : undefined,
            createdAtUtc: String(d.createdAtUtc ?? ""),
            updatedAtUtc: String(d.updatedAtUtc ?? ""),
            gestorDiretoId: d.gestorDiretoId ? String(d.gestorDiretoId) : undefined,
            gestorDiretoNome: d.gestorDiretoNome ? String(d.gestorDiretoNome) : undefined,
            nivelHierarquicoId: d.nivelHierarquicoId ? String(d.nivelHierarquicoId) : undefined,
            nivelHierarquicoNome: d.nivelHierarquicoNome ? String(d.nivelHierarquicoNome) : undefined,
            unidadeLotacaoId: d.unidadeLotacaoId ? String(d.unidadeLotacaoId) : undefined,
            unidadeLotacaoDescricao: d.unidadeLotacaoDescricao ? String(d.unidadeLotacaoDescricao) : undefined,
            unidadeLotacaoCode: d.unidadeLotacaoCode ? String(d.unidadeLotacaoCode) : undefined,
            centroCustoId: d.centroCustoId ? String(d.centroCustoId) : undefined,
            centroCustoDescricao: d.centroCustoDescricao ? String(d.centroCustoDescricao) : undefined,
            centroCustoCode: d.centroCustoCode ? String(d.centroCustoCode) : undefined,
            cdnFuncionario: d.cdnFuncionario ? String(d.cdnFuncionario) : undefined,
            cdnEmpresa: d.cdnEmpresa ? String(d.cdnEmpresa) : undefined,
            cdnEstab: d.cdnEstab ? String(d.cdnEstab) : undefined,
            dataAdmissao: d.dataAdmissao ? String(d.dataAdmissao) : undefined,
            dataNascimento: d.dataNascimento ? String(d.dataNascimento) : undefined,
            sexo: d.sexo ? String(d.sexo) : undefined,
            matriculaRm: d.matriculaRm ? String(d.matriculaRm) : undefined,
            hierarquiaId: d.hierarquiaId ? String(d.hierarquiaId) : undefined,
            hierarquiaDescricao: d.hierarquiaDescricao ? String(d.hierarquiaDescricao) : undefined,
            codSituacaoRm: d.codSituacaoRm ? String(d.codSituacaoRm) : undefined,
            situacaoRmDescricao: d.situacaoRmDescricao ? String(d.situacaoRmDescricao) : undefined,
        };
    }

    async function openDetail(id: string) {
        setDetailId(id);
        setDetailData(null);
        setDetailLoading(true);
        setDetailTab("dados");
        setHistoryItems([]);
        setMovimentacoesItems([]);
        void loadDetailHistory(id);
        try {
            const d = await fetchJson<Record<string, unknown>>(`/api/funcionarios/${id}`);
            setDetailData(mapFuncDetail(d, id));
        } catch { toast.error("Falha ao carregar dados do funcionário."); setDetailId(null); }
        finally { setDetailLoading(false); }
    }

    function closeDetail() { setDetailId(null); setDetailData(null); setHistoryItems([]); setMovimentacoesItems([]); setDetailTab("dados"); setEditForm(EMPTY_EDIT_FORM); }

    async function enterEditMode(data: FuncDetail) {
        setEditForm({
            name: data.name,
            email: data.email ?? "",
            phone: data.phone ?? "",
            status: data.status,
            headcount: data.headcount,
            unitId: data.unitId ?? "", unitLabel: data.unitName ?? "",
            areaId: data.areaId ?? "", areaLabel: data.areaName ?? "",
            jobPositionId: data.jobPositionId ?? "", jobPositionLabel: data.jobPositionName ? (data.jobPositionCode ? `${data.jobPositionCode} - ${data.jobPositionName}` : data.jobPositionName) : "",
            requisitoCategoriaId: data.requisitoCategoriaId ?? "", requisitoCategoriaLabel: data.requisitoCategoriaName ?? "",
            gestorDiretoId: data.gestorDiretoId ?? "", gestorDiretoLabel: data.gestorDiretoNome ?? "",
            nivelHierarquicoId: data.nivelHierarquicoId ?? "", nivelHierarquicoLabel: data.nivelHierarquicoNome ?? "",
            unidadeLotacaoId: data.unidadeLotacaoId ?? "", unidadeLotacaoLabel: data.unidadeLotacaoDescricao ? (data.unidadeLotacaoCode ? `${data.unidadeLotacaoCode} - ${data.unidadeLotacaoDescricao}` : data.unidadeLotacaoDescricao) : "",
            centroCustoId: data.centroCustoId ?? "", centroCustoLabel: data.centroCustoDescricao ? (data.centroCustoCode ? `${data.centroCustoCode} - ${data.centroCustoDescricao}` : data.centroCustoDescricao) : "",
            cdnFuncionario: data.cdnFuncionario ?? "",
            cdnEmpresa: data.cdnEmpresa ?? "",
            cdnEstab: data.cdnEstab ?? "",
            dataAdmissao: data.dataAdmissao ?? "",
            dataNascimento: data.dataNascimento ?? "",
            sexo: data.sexo ?? "",
            notes: data.notes ?? "",
        });
        setDetailTab("editar");
        if (!editOptions) {
            setEditOptionsLoading(true);
            try {
                const [units, areas, jobPositions, nivelHierarquicos, requisitoCategorias] = await Promise.all([
                    fetchJson<{ id: string; code: string; name: string }[]>("/api/lookup/units"),
                    fetchJson<{ id: string; code: string; name: string }[]>("/api/lookup/areas"),
                    fetchJson<{ id: string; code: string; name: string }[]>("/api/lookup/job-positions"),
                    fetchJson<{ id: string; nome: string }[]>("/api/niveis-hierarquicos"),
                    fetchJson<{ id: string; code: string; name: string }[]>("/api/requisito-categorias"),
                ]);
                setEditOptions({
                    units: (units ?? []).map((u) => ({ id: String(u.id), label: u.code ? `${u.code} - ${u.name}` : u.name })),
                    areas: (areas ?? []).map((a) => ({ id: String(a.id), label: a.name })),
                    jobPositions: (jobPositions ?? []).map((j) => ({ id: String(j.id), label: j.code ? `${j.code} - ${j.name}` : j.name })),
                    nivelHierarquicos: (nivelHierarquicos ?? []).map((n) => ({ id: String(n.id), label: n.nome })),
                    requisitoCategorias: (requisitoCategorias ?? []).map((r) => ({ id: String(r.id), label: r.code ? `${r.code} - ${r.name}` : r.name })),
                });
            } catch {
                toast.error("Falha ao carregar opções de edição.");
            } finally {
                setEditOptionsLoading(false);
            }
        }
    }

    async function saveEdit() {
        if (!detailId || !detailData) return;
        setEditSaving(true);
        try {
            const body = {
                name: editForm.name.trim(),
                email: editForm.email.trim() || null,
                phone: editForm.phone.trim() || null,
                status: editForm.status,
                headcount: editForm.headcount,
                unitId: editForm.unitId || null,
                areaId: editForm.areaId || null,
                jobPositionId: editForm.jobPositionId || null,
                requisitoCategoriaId: editForm.requisitoCategoriaId || null,
                notes: editForm.notes.trim() || null,
                gestorDiretoId: editForm.gestorDiretoId || null,
                nivelHierarquicoId: editForm.nivelHierarquicoId || null,
                unidadeLotacaoId: editForm.unidadeLotacaoId || null,
                centroCustoId: editForm.centroCustoId || null,
                cdnFuncionario: editForm.cdnFuncionario.trim() || null,
                cdnEmpresa: editForm.cdnEmpresa.trim() || null,
                cdnEstab: editForm.cdnEstab.trim() || null,
                dataAdmissao: editForm.dataAdmissao || null,
                dataNascimento: editForm.dataNascimento || null,
                sexo: editForm.sexo || null,
            };
            const updated = await fetchJson<Record<string, unknown>>(`/api/funcionarios/${detailId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const mapped = mapFuncDetail(updated, detailId);
            setDetailData(mapped);
            setDetailTab("dados");
            toast.success("Funcionário atualizado com sucesso.");
            void syncList({ page, pageSize, search: q, status: statusFilter, sort, dir, lotacao: lotacaoFilter, centroCusto: centroCustoFilter });
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setEditSaving(false);
        }
    }

    /* Delete */
    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`/api/funcionarios/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Funcionário excluído.");
            setDeleteTarget(null);
            const targetPage = totalItems > 1 && rows.length === 1 && page > 1 ? page - 1 : page;
            await syncList({ page: targetPage, pageSize, search: q, status: statusFilter });
        } catch { toast.error("Falha ao excluir."); }
    }

    /* Import */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
                if (raw.length === 0) { toast.error("Planilha vazia."); return; }
                const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const parsed: ImportRow[] = raw.map((r) => {
                    const key = (variants: string[]) => {
                        const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v)));
                        return f ? String(r[f] ?? "").trim() : "";
                    };
                    return {
                        cdnFuncionario: key(["cdn_funcionario", "cdnfuncionario", "matricula"]),
                        cdnEmpresa:     key(["cdn_empresa", "cdnempresa", "empresa"]),
                        cdnEstab:       key(["cdn_estab", "cdnestab", "estab"]),
                        nome:           key(["nom_pessoa_fisic", "nome", "name"]),
                        email:          key(["nom_e_mail", "email", "e-mail"]),
                        cpf:            key(["cod_id_feder", "cpf"]),
                        dataNascimento: key(["dat_nascimento", "datanascimento", "nascimento"]),
                        rg:             key(["cod_id_estad_fisic", "rg"]),
                        fone:           key(["fone", "telefone", "phone"]),
                        cep:            key(["cod_cep_rh", "cep"]),
                        logradouro:     key(["nom_ender_rh", "logradouro", "endereco"]),
                        numeroEndereco: key(["cod_num_ender", "numero", "num_ender"]),
                        bairro:         key(["nom_bairro_rh", "bairro"]),
                        cidade:         key(["nom_cidad_rh", "cidade"]),
                        uf:             key(["cod_unid_federac_rh", "uf", "estado"]),
                        codUnidLotac:    key(["cod_unid_lotac", "unidade_lotac", "unid_lotac"]),
                        cdnPlanoLotac:   key(["cdn_plano_lotac", "cdnplanolotac", "plano_lotac", "plano"]),
                        dataInicCargo:   key(["dat_inic_cargo", "data_inicio", "admissao"]),
                        codCargo:        key(["cod_cargo", "cargo"]),
                        codCentroCusto:  key(["cod_ccusto", "cod_rh_ccusto", "centro_custo", "ccusto"]),
                        codNivCargo:     key(["cdn_niv_cargo", "niv_cargo", "nivel_cargo"]),
                    };
                }).filter((r) => r.cdnFuncionario && r.cdnEmpresa && r.cdnEstab);
                if (parsed.length === 0) { toast.error("Nenhuma linha válida. Verifique as colunas cdn_funcionario, cdn_empresa e cdn_estab."); return; }
                setImportRows(parsed); setImportResult(null); setImportOpen(true);
            } catch { toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv."); }
        };
        reader.readAsArrayBuffer(file);
    };

    const runImport = async () => {
        if (importRows.length === 0) return;
        setImporting(true);
        try {
            const payload = importRows.map((r) => ({
                cdnFuncionario: r.cdnFuncionario,
                cdnEmpresa:     r.cdnEmpresa,
                cdnEstab:       r.cdnEstab,
                nome:           r.nome,
                email:          r.email,
                cpf:            r.cpf || null,
                dataNascimento: r.dataNascimento || null,
                rg:             r.rg || null,
                fone:           r.fone || null,
                cep:            r.cep || null,
                logradouro:     r.logradouro || null,
                numeroEndereco: r.numeroEndereco || null,
                bairro:         r.bairro || null,
                cidade:         r.cidade || null,
                uf:             r.uf || null,
                codUnidLotac:    r.codUnidLotac || null,
                cdnPlanoLotac:   r.cdnPlanoLotac || null,
                dataInicCargo:   r.dataInicCargo || null,
                codCargo:        r.codCargo || null,
                codCentroCusto:  r.codCentroCusto || null,
                codNivCargo:     r.codNivCargo || null,
            }));
            const result = await fetchJson<{ created: number; updated: number; skipped: number; errors: string[]; warnings: string[] }>(
                "/api/funcionarios/import",
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
                5 * 60 * 1000
            );
            setImportResult({ created: result.created, updated: result.updated, errors: result.skipped + result.errors.length, warnings: result.warnings ?? [] });
            setLoading(true);
            await syncList({ page: 1, pageSize, search: q, status: statusFilter });
        } catch (e) {
            toast.error(`Falha na importação: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setImporting(false);
            setLoading(false);
        }
    };

    const exportTsv = () => {
        const csv = [
            ["Matrícula", "Empresa", "Estab", "Nome", "Email", "Telefone", "Unid. Lotação", "Centro de Custo", "Cargo", "Status"].join("\t"),
            ...rows.map((f) => [
                f.cdnFuncionario || "", f.cdnEmpresa || "", f.cdnEstab || "",
                f.nome, f.email || "", f.telefone || "",
                f.unidade, f.centroCustoNome, f.cargo, f.status,
            ].join("\t")),
        ].join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/plain;charset=utf-8;" }));
        link.download = "funcionarios.tsv";
        link.click();
    };

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-bold">Funcionários</h4>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportTsv} title="Exportar">
                        <Download className="size-4" /><span className="hidden sm:inline ml-1">Exportar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title="Importar">
                        <Upload className="size-4" /><span className="hidden sm:inline ml-1">Importar</span>
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                    <Button variant="outline" size="sm" onClick={() => { setLoading(true); syncList({ page: 1, pageSize, search: q, status: statusFilter, sort, dir, lotacao: lotacaoFilter, centroCusto: centroCustoFilter }).catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Funcionários", value: kpis.total, color: "text-primary" },
                    { label: "Ativos", value: kpis.active, color: "text-emerald-600" },
                    { label: "Headcount", value: kpis.headcount, color: "text-amber-600" },
                    { label: "Unidades", value: kpis.uniqueUnidades, color: "text-primary" },
                ].map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* Table card */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Lista de funcionários</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, matrícula, email, area..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                            <option value="com_erro">⚠ Com erro</option>
                        </select>
                        <div className="w-[200px]">
                            <FilterAutocomplete
                                fetchOptions={fetchLotacaoOptions}
                                value={lotacaoFilter}
                                onChange={(id) => setLotacaoFilter(id)}
                                placeholder="Lotação..."
                            />
                        </div>
                        <div className="w-[200px]">
                            <FilterAutocomplete
                                fetchOptions={fetchCentroCustoOptions}
                                value={centroCustoFilter}
                                onChange={(id) => setCentroCustoFilter(id)}
                                placeholder="Centro de custo..."
                            />
                        </div>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Estab</TableHead>
                            <TableHead>Matrícula</TableHead>
                            <TableHead title="CHAPA do TOTVS RM">RM</TableHead>
                            {(() => {
                                const sortHead = (col: string, label: string) => {
                                    const active = sort === col;
                                    const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                                    return (
                                        <TableHead
                                            key={col}
                                            className="cursor-pointer select-none whitespace-nowrap"
                                            onClick={() => { const nd = active && dir === "asc" ? "desc" : "asc"; setSort(col); setDir(nd); }}
                                        >
                                            <span className="inline-flex items-center gap-1">{label}<Icon className={`size-3 ${active ? "" : "opacity-30"}`} /></span>
                                        </TableHead>
                                    );
                                };
                                return (<>
                                    {sortHead("funcionario", "Nome / Email")}
                                    {sortHead("unidadelotacao", "Lotação")}
                                    {sortHead("centrocusto", "Centro de Custo")}
                                    {sortHead("status", "Status")}
                                </>);
                            })()}
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : rows.length ? rows.map((f) => (
                            <TableRow key={f.id}>
                                <TableCell className="font-mono text-sm text-muted-foreground">{f.cdnEmpresa || "—"}</TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">{f.cdnEstab || "—"}</TableCell>
                                <TableCell className="font-mono text-sm">{f.cdnFuncionario || "—"}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground" title={f.hierarquiaDescricao ? `Hierarquia: ${f.hierarquiaDescricao}` : undefined}>
                                    {f.matriculaRm ? (
                                        <div className="flex flex-col gap-0.5">
                                            <span>{f.matriculaRm}</span>
                                            {f.situacaoRmDescricao && (
                                                <span className={`inline-flex items-center px-1.5 py-0 text-[10px] font-medium rounded w-fit ${
                                                    f.codSituacaoRm === "A" ? "bg-emerald-100 text-emerald-700"
                                                    : f.codSituacaoRm === "F" ? "bg-blue-100 text-blue-700"
                                                    : f.codSituacaoRm === "P" ? "bg-cyan-100 text-cyan-700"
                                                    : f.codSituacaoRm === "D" ? "bg-rose-100 text-rose-700"
                                                    : f.codSituacaoRm === "I" ? "bg-amber-100 text-amber-700"
                                                    : "bg-slate-100 text-slate-600"
                                                }`} title={`CODSITUACAO=${f.codSituacaoRm}`}>
                                                    {f.situacaoRmDescricao}
                                                </span>
                                            )}
                                        </div>
                                    ) : "—"}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold">{f.nome}</span>
                                        {f.hasIncompleteData && (
                                            <span title={missingFieldsTooltip(f)}>
                                                <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{f.email || "—"}</div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{f.unidade ? (f.unidadeLotacaoCode ? `${f.unidadeLotacaoCode} - ${f.unidade}` : f.unidade) : "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{f.centroCustoDescricao ? (f.centroCustoCode ? `${f.centroCustoCode} - ${f.centroCustoDescricao}` : f.centroCustoDescricao) : "—"}</TableCell>
                                <TableCell>{statusBadge(f.status)}</TableCell>
                                <TableCell className="text-right">
                                    {(() => {
                                        // Funcionários importados (RM/Datasul) são read-only — exclusão só no ERP de origem.
                                        const importado = !!f.matriculaRm
                                            || (!!f.cdnFuncionario && !!f.cdnEmpresa && !!f.cdnEstab);
                                        return (
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="outline" size="icon-xs" title="Ver detalhes" onClick={() => void openDetail(f.id)}><Eye /></Button>
                                                <Link href={`/funcionarios/perfil?id=${f.id}`}>
                                                    <Button variant="outline" size="icon-xs" title="Ver Perfil 360°"><UserCircle /></Button>
                                                </Link>
                                                {!importado && (
                                                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(f)}><Trash2 /></Button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum funcionário encontrado.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <PaginationBar
                    page={page}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    pageSizes={PAGE_SIZES}
                    onPageChange={(nextPage) => {
                        if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
                        setLoading(true);
                        syncList({ page: nextPage, pageSize, search: q, status: statusFilter })
                            .catch(() => toast.error("Falha ao carregar página."))
                            .finally(() => setLoading(false));
                    }}
                    onPageSizeChange={(nextPageSize) => {
                        const safeSize = Number.isFinite(nextPageSize) ? Math.min(100, Math.max(10, Math.trunc(nextPageSize))) : 20;
                        setLoading(true);
                        syncList({ page: 1, pageSize: safeSize, search: q, status: statusFilter })
                            .catch(() => toast.error("Falha ao alterar página."))
                            .finally(() => setLoading(false));
                    }}
                />
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) closeDetail(); }}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{detailData?.name ?? "Funcionário"}</DialogTitle>
                        <DialogDescription>{detailTab === "editar" ? "Edite os dados do colaborador." : "Dados do colaborador."}</DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap gap-2">
                        {(
                            [
                                { k: "dados", label: "Dados" },
                                { k: "editar", label: "Editar" },
                                { k: "historico", label: "Histórico" },
                            ] as const
                        ).map((t) => {
                            // Funcionários importados (RM/Datasul) são read-only — fonte da verdade está no ERP.
                            const isImported = !!detailData?.matriculaRm
                                || (!!detailData?.cdnFuncionario && !!detailData?.cdnEmpresa && !!detailData?.cdnEstab);
                            const blockEdit = t.k === "editar" && isImported;
                            return (
                            <Button
                                key={t.k}
                                type="button"
                                size="sm"
                                variant={detailTab === t.k ? "default" : "outline"}
                                onClick={() => {
                                    if (blockEdit) return;
                                    if (t.k === "editar" && detailData) { void enterEditMode(detailData); }
                                    else setDetailTab(t.k);
                                }}
                                disabled={detailLoading || blockEdit}
                                title={blockEdit ? "Funcionário importado do ERP — somente leitura." : undefined}
                            >
                                {t.k === "editar" && <Pencil className="size-3 mr-1" />}
                                {t.label}
                            </Button>
                            );
                        })}
                    </div>

                    {detailLoading ? (
                        <div className="py-12 text-center text-muted-foreground text-sm">Carregando…</div>
                    ) : detailTab === "dados" && detailData ? (
                        <div className="space-y-5">
                            {/* Banner — Dados incompletos (não aplica a RM, que é gerido externamente) */}
                            {(() => {
                                const isRm = !!detailData.matriculaRm;
                                if (isRm) return null;
                                const missing: string[] = [];
                                if (!detailData.name?.trim()) missing.push("Nome");
                                if (!detailData.jobPositionName) missing.push("Cargo");
                                if (!detailData.unidadeLotacaoDescricao) missing.push("Unidade de Lotação");
                                if (!detailData.nivelHierarquicoNome) missing.push("Nível do Cargo");
                                if (!detailData.centroCustoDescricao) missing.push("Centro de Custo");
                                return missing.length > 0 ? (
                                    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                        <div><span className="font-semibold">Dados incompletos: </span>{missing.join(", ")}</div>
                                    </div>
                                ) : null;
                            })()}

                            {/* Identificação */}
                            <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
                                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                    <div className="col-span-2 sm:col-span-3">
                                        <dt className="text-xs font-medium text-muted-foreground">Nome</dt>
                                        <dd className="mt-0.5 text-sm font-semibold">{detailData.name}</dd>
                                    </div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">E-mail</dt><dd className="mt-0.5 text-sm">{detailData.email || "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Telefone</dt><dd className="mt-0.5 text-sm">{detailData.phone || "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Status</dt><dd className="mt-0.5">{statusBadge(detailData.status)}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Headcount</dt><dd className="mt-0.5 text-sm">{detailData.headcount}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Data de Admissão</dt><dd className="mt-0.5 text-sm">{detailData.dataAdmissao ? new Date(detailData.dataAdmissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Data de Nascimento</dt><dd className="mt-0.5 text-sm">{detailData.dataNascimento ? new Date(detailData.dataNascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Sexo</dt><dd className="mt-0.5 text-sm">{detailData.sexo === "M" ? "Masculino" : detailData.sexo === "F" ? "Feminino" : "—"}</dd></div>
                                </dl>
                            </div>

                            <hr className="border-border/40" />

                            {/* Organização */}
                            <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organização</p>
                                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                    <div><dt className="text-xs font-medium text-muted-foreground">Unidade</dt><dd className="mt-0.5 text-sm">{detailData.unitName || "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Área</dt><dd className="mt-0.5 text-sm">{detailData.areaName || "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Cargo</dt><dd className="mt-0.5 text-sm">{detailData.jobPositionName ? (detailData.jobPositionCode ? `${detailData.jobPositionCode} - ${detailData.jobPositionName}` : detailData.jobPositionName) : "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Função</dt><dd className="mt-0.5 text-sm">{detailData.requisitoCategoriaName || "—"}</dd></div>
                                </dl>
                            </div>

                            <hr className="border-border/40" />

                            {/* Hierarquia */}
                            <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hierarquia</p>
                                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                    <div><dt className="text-xs font-medium text-muted-foreground">Gestor Direto</dt><dd className="mt-0.5 text-sm">{detailData.gestorDiretoNome || "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Nível Hierárquico</dt><dd className="mt-0.5 text-sm">{detailData.nivelHierarquicoNome || "—"}</dd></div>
                                </dl>
                            </div>

                            <hr className="border-border/40" />

                            {/* Lotação TOTVS */}
                            <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lotação TOTVS Datasul</p>
                                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                    <div className="col-span-2 sm:col-span-3"><dt className="text-xs font-medium text-muted-foreground">Unidade de Lotação</dt><dd className="mt-0.5 text-sm">{detailData.unidadeLotacaoDescricao ? (detailData.unidadeLotacaoCode ? `${detailData.unidadeLotacaoCode} - ${detailData.unidadeLotacaoDescricao}` : detailData.unidadeLotacaoDescricao) : "—"}</dd></div>
                                    <div className="col-span-2 sm:col-span-3"><dt className="text-xs font-medium text-muted-foreground">Centro de Custo</dt><dd className="mt-0.5 text-sm">{detailData.centroCustoDescricao ? (detailData.centroCustoCode ? `${detailData.centroCustoCode} - ${detailData.centroCustoDescricao}` : detailData.centroCustoDescricao) : "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Matrícula</dt><dd className="mt-0.5 font-mono text-sm">{detailData.cdnFuncionario || "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Empresa</dt><dd className="mt-0.5 font-mono text-sm">{detailData.cdnEmpresa || "—"}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Estabelecimento</dt><dd className="mt-0.5 font-mono text-sm">{detailData.cdnEstab || "—"}</dd></div>
                                </dl>
                            </div>

                            {(detailData.notes || detailData.createdAtUtc) && (
                                <>
                                    <hr className="border-border/40" />
                                    <div>
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações e Auditoria</p>
                                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                            {detailData.notes && (
                                                <div className="col-span-2 sm:col-span-3">
                                                    <dt className="text-xs font-medium text-muted-foreground">Observações</dt>
                                                    <dd className="mt-0.5 text-sm whitespace-pre-line">{detailData.notes}</dd>
                                                </div>
                                            )}
                                            <div><dt className="text-xs font-medium text-muted-foreground">Criado em</dt><dd className="mt-0.5 text-sm">{fmt(detailData.createdAtUtc)}</dd></div>
                                            <div><dt className="text-xs font-medium text-muted-foreground">Atualizado em</dt><dd className="mt-0.5 text-sm">{fmt(detailData.updatedAtUtc)}</dd></div>
                                        </dl>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : null}

                    {detailTab === "editar" ? (
                        editOptionsLoading ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">Carregando opções…</div>
                        ) : (
                            <div className="space-y-5">
                                {/* Identificação */}
                                <div>
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
                                            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">E-mail</label>
                                            <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Telefone</label>
                                            <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                                                <option value="Active">Ativo</option>
                                                <option value="Inactive">Inativo</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Headcount</label>
                                            <Input type="number" min={0} value={editForm.headcount} onChange={(e) => setEditForm((f) => ({ ...f, headcount: parseInt(e.target.value, 10) || 0 }))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Data de Admissão</label>
                                            <Input type="date" value={editForm.dataAdmissao} onChange={(e) => setEditForm((f) => ({ ...f, dataAdmissao: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Data de Nascimento</label>
                                            <Input type="date" value={editForm.dataNascimento} onChange={(e) => setEditForm((f) => ({ ...f, dataNascimento: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Sexo</label>
                                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.sexo} onChange={(e) => setEditForm((f) => ({ ...f, sexo: e.target.value }))}>
                                                <option value="">— Não informado —</option>
                                                <option value="M">Masculino</option>
                                                <option value="F">Feminino</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-border/40" />

                                {/* Organização */}
                                <div>
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organização</p>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Unidade</label>
                                            <FilterAutocomplete fetchOptions={fetchEditUnits} value={editForm.unitId} initialLabel={editForm.unitLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, unitId: id, unitLabel: label }))} placeholder="Buscar unidade…" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Área</label>
                                            <FilterAutocomplete fetchOptions={fetchEditAreas} value={editForm.areaId} initialLabel={editForm.areaLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, areaId: id, areaLabel: label }))} placeholder="Buscar área…" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Cargo</label>
                                            <FilterAutocomplete fetchOptions={fetchEditJobPositions} value={editForm.jobPositionId} initialLabel={editForm.jobPositionLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, jobPositionId: id, jobPositionLabel: label }))} placeholder="Buscar cargo…" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Função</label>
                                            <FilterAutocomplete fetchOptions={fetchEditRequisitoCategorias} value={editForm.requisitoCategoriaId} initialLabel={editForm.requisitoCategoriaLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, requisitoCategoriaId: id, requisitoCategoriaLabel: label }))} placeholder="Buscar função…" />
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-border/40" />

                                {/* Hierarquia */}
                                <div>
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hierarquia</p>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Gestor Direto</label>
                                            <FilterAutocomplete fetchOptions={fetchEditGestorDireto} value={editForm.gestorDiretoId} initialLabel={editForm.gestorDiretoLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, gestorDiretoId: id, gestorDiretoLabel: label }))} placeholder="Buscar funcionário…" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Nível Hierárquico</label>
                                            <FilterAutocomplete fetchOptions={fetchEditNivelHierarquico} value={editForm.nivelHierarquicoId} initialLabel={editForm.nivelHierarquicoLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, nivelHierarquicoId: id, nivelHierarquicoLabel: label }))} placeholder="Buscar nível…" />
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-border/40" />

                                {/* Lotação TOTVS */}
                                <div>
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lotação TOTVS</p>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Unidade de Lotação</label>
                                            <FilterAutocomplete fetchOptions={fetchEditUnidadeLotacao} value={editForm.unidadeLotacaoId} initialLabel={editForm.unidadeLotacaoLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, unidadeLotacaoId: id, unidadeLotacaoLabel: label }))} placeholder="Buscar unidade de lotação…" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Centro de Custo</label>
                                            <FilterAutocomplete fetchOptions={fetchEditCentroCusto} value={editForm.centroCustoId} initialLabel={editForm.centroCustoLabel} onChange={(id, label) => setEditForm((f) => ({ ...f, centroCustoId: id, centroCustoLabel: label }))} placeholder="Buscar centro de custo…" />
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-border/40" />

                                {/* Chaves TOTVS */}
                                <div>
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chaves TOTVS Datasul</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Matrícula</label>
                                            <Input className="font-mono" value={editForm.cdnFuncionario} onChange={(e) => setEditForm((f) => ({ ...f, cdnFuncionario: e.target.value }))} placeholder="cdn_funcionario" maxLength={12} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
                                            <Input className="font-mono" value={editForm.cdnEmpresa} onChange={(e) => setEditForm((f) => ({ ...f, cdnEmpresa: e.target.value }))} placeholder="cdn_empresa" maxLength={3} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Estabelecimento</label>
                                            <Input className="font-mono" value={editForm.cdnEstab} onChange={(e) => setEditForm((f) => ({ ...f, cdnEstab: e.target.value }))} placeholder="cdn_estab" maxLength={5} />
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-border/40" />

                                {/* Observações */}
                                <div>
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
                                    <textarea
                                        className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                                        placeholder="Observações sobre o funcionário…"
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )
                    ) : null}

                    {detailTab === "historico" ? (
                        <div className="mt-2">
                            {historyLoading ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">Carregando histórico…</div>
                            ) : (() => {
                                const events: TimelineEvent[] = [
                                    ...historyItems.map((h) => ({
                                        kind: "audit" as const,
                                        key: `audit-${h.id}`,
                                        occurredAt: h.occurredAt,
                                        data: h,
                                    })),
                                    ...movimentacoesItems.map((m) => ({
                                        kind: "movimentacao" as const,
                                        key: `mov-${m.id}`,
                                        occurredAt: m.dataAbertura,
                                        data: m,
                                    })),
                                    ...(detailData?.dataAdmissao ? [{
                                        kind: "admissao" as const,
                                        key: "admissao",
                                        occurredAt: detailData.dataAdmissao,
                                        dataAdmissao: detailData.dataAdmissao,
                                    }] : []),
                                ].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

                                if (events.length === 0) {
                                    return <div className="py-6 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>;
                                }

                                return (
                                    <div className="space-y-2">
                                        {events.map((e) => e.kind === "audit" ? (
                                            <div key={e.key} className="rounded-xl border border-border/40 bg-card/50 p-3 text-sm">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="font-medium">
                                                        {fmt(e.data.occurredAt)} — {stateLabel(e.data.state)}
                                                        {e.data.changedColumns ? <span className="text-muted-foreground"> ({e.data.changedColumns})</span> : null}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{e.data.userName ? `por ${e.data.userName}` : ""}</div>
                                                </div>
                                            </div>
                                        ) : e.kind === "admissao" ? (
                                            <div key={e.key} className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-sm">
                                                <div className="font-medium text-emerald-700 dark:text-emerald-300">
                                                    {new Date(e.dataAdmissao + "T00:00:00").toLocaleDateString("pt-BR")} — Admissão
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={e.key} className="rounded-xl border border-violet-300/50 bg-violet-50/40 dark:bg-violet-950/20 p-3 text-sm">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="font-medium text-violet-700 dark:text-violet-300">
                                                        {fmt(e.data.dataAbertura)} — {e.data.tipoDescricao ?? `Movimentação ${e.data.tipoMovimentacao}`}
                                                        {e.data.statusDescricao ? <span className="text-muted-foreground"> · {e.data.statusDescricao}</span> : null}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">#{e.data.idReqRm}</div>
                                                </div>
                                                {(e.data.codFuncaoOrigem || e.data.codFuncaoDestino) && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Função: {e.data.codFuncaoOrigem ?? "—"} → {e.data.codFuncaoDestino ?? "—"}
                                                    </div>
                                                )}
                                                {(e.data.codSecaoOrigem || e.data.codSecaoDestino) && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Seção: {e.data.codSecaoOrigem ?? "—"} → {e.data.codSecaoDestino ?? "—"}
                                                    </div>
                                                )}
                                                {(e.data.salarioOrigem != null || e.data.salarioDestino != null) && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Salário: {e.data.salarioOrigem != null ? `R$ ${e.data.salarioOrigem.toFixed(2)}` : "—"} → {e.data.salarioDestino != null ? `R$ ${e.data.salarioDestino.toFixed(2)}` : "—"}
                                                    </div>
                                                )}
                                                {e.data.dataConclusao && (
                                                    <div className="text-xs text-muted-foreground">Concluída em: {fmt(e.data.dataConclusao)}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : null}

                    <DialogFooter>
                        {detailTab === "editar" ? (
                            <>
                                <Button variant="outline" onClick={() => setDetailTab("dados")} disabled={editSaving}>Cancelar</Button>
                                <Button onClick={() => void saveEdit()} disabled={editSaving || !editForm.name.trim()}>
                                    {editSaving ? "Salvando…" : "Salvar"}
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={closeDetail}>Fechar</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) { setImportOpen(open); if (!open) { setImportRows([]); setImportResult(null); } } }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Importar Colaboradores</DialogTitle>
                        <DialogDescription>
                            {importResult
                                ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.`
                                : `${importRows.length} registro(s) encontrado(s). Chave de upsert: Empresa + Estab + Matrícula.`}
                        </DialogDescription>
                    </DialogHeader>
                    <ImportGuide entity="Colaboradores" columns={[
                        { name: "cdn_funcionario", hint: "Matrícula TOTVS", required: true },
                        { name: "cdn_empresa",     hint: "Código da empresa (ex: 1)", required: true },
                        { name: "cdn_estab",       hint: "Código do estabelecimento", required: true },
                        { name: "nom_pessoa_fisic", hint: "Nome completo", required: true },
                        { name: "nom_e_mail",      hint: "E-mail (chave Pessoa)", required: true },
                        { name: "cod_id_feder",    hint: "CPF" },
                        { name: "dat_nascimento",  hint: "dd/MM/yyyy" },
                        { name: "cod_id_estad_fisic", hint: "RG" },
                        { name: "fone",            hint: "Telefone" },
                        { name: "cod_unid_lotac",  hint: "Código da unidade de lotação" },
                        { name: "cdn_plano_lotac", hint: "Código do plano de lotação TOTVS" },
                        { name: "dat_inic_cargo",  hint: "Data de admissão dd/MM/yyyy" },
                    ]} />
                    {!importResult && (
                        <div className="max-h-64 overflow-y-auto border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Empresa</th>
                                        <th className="px-3 py-2 text-left font-medium">Estab</th>
                                        <th className="px-3 py-2 text-left font-medium">Matrícula</th>
                                        <th className="px-3 py-2 text-left font-medium">Nome</th>
                                        <th className="px-3 py-2 text-left font-medium">Plano</th>
                                        <th className="px-3 py-2 text-left font-medium">Lotação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importRows.slice(0, 50).map((r, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.cdnEmpresa}</td>
                                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.cdnEstab}</td>
                                            <td className="px-3 py-1.5 font-mono">{r.cdnFuncionario}</td>
                                            <td className="px-3 py-1.5">{r.nome}</td>
                                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.cdnPlanoLotac || <span className="text-amber-600">sem plano</span>}</td>
                                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.codUnidLotac || "—"}</td>
                                        </tr>
                                    ))}
                                    {importRows.length > 50 && (
                                        <tr className="border-t"><td colSpan={6} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {importRows.length - 50} registro(s)</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {importResult && importResult.warnings.length > 0 && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
                            <p className="font-semibold text-amber-800 dark:text-amber-400 mb-1">
                                {importResult.warnings.length} colaborador(es) importados sem lotação:
                            </p>
                            <ul className="max-h-36 overflow-y-auto space-y-0.5">
                                {importResult.warnings.map((w, i) => (
                                    <li key={i} className="font-mono text-xs text-amber-700 dark:text-amber-300">{w}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null); }} disabled={importing}>
                            {importResult ? "Fechar" : "Cancelar"}
                        </Button>
                        {!importResult && (
                            <Button onClick={() => void runImport()} disabled={importing}>
                                {importing ? "Importando…" : `Importar ${importRows.length} registro(s)`}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>Excluir o funcionário <strong>&quot;{deleteTarget?.nome}&quot;</strong>?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => void confirmDelete()}>Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
