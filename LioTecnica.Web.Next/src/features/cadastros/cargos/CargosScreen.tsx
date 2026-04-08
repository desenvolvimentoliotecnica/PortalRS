"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";
import { apiFetch } from "@/lib/api";
import { getScreenCache, setScreenCache } from "@/lib/screenCache";



/* ---------- types ---------- */
interface CargoItem {
    id: string;
    codigo: string;
    nome: string;
    area: string;
    areaId?: string;
    senioridade: string;
    funcionarios?: number;
    gestores?: number;
    headcount?: number;
    status: string;
    tipo?: string;
    description?: string;
    updatedAtUtc?: string;
}

interface CargoDraft {
    id?: string;
    code: string;
    name: string;
    areaId: string | null;
    seniority: string;
    status: string;
    tipo: string;
    occupationalClassification: string;
    description: string;
    similarityIndicator: string;
    fullDescription: string;
    updatedAtUtc?: string;
}

interface AreaLookup { id: string; name: string }

/* ---------- helpers ---------- */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        const msg = `HTTP ${res.status}: ${t || res.statusText}`;
        console.error(`[apiFetch] ${init?.method ?? "GET"} ${url} → ${msg}`);
        throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function escapeTsvCell(s: string) {
    return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function statusBadge(s: string | null | undefined) {
    const st = (s ?? "").toLowerCase();
    if (st === "ativo" || st === "active")
        return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>;
    return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>;
}

const emptyDraft: CargoDraft = {
    code: "", name: "", areaId: null, seniority: "", status: "ativo", tipo: "", occupationalClassification: "", description: "",
    similarityIndicator: "", fullDescription: "",
};

const textareaClass = cn(
    "placeholder:text-muted-foreground border-input min-h-[88px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none md:text-sm",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/* ---------- component ---------- */
export default function CargosScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<CargoItem[]>([]);
    const [areas, setAreas] = useState<AreaLookup[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<CargoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<CargoItem | null>(null);
    const [detailItem, setDetailItem] = useState<CargoItem | null>(null);
    const [detailFull, setDetailFull] = useState<Record<string, unknown> | null>(null);

    // Import
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importRows, setImportRows] = useState<CargoDraft[]>([]);
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number } | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<{ items: Record<string, unknown>[] }>(`/api/job-positions`);
        const mapped: CargoItem[] = (Array.isArray(payload?.items) ? payload.items : []).map((i) => ({
            id: String(i.id ?? ""),
            codigo: String(i.code ?? ""),
            nome: String(i.name ?? ""),
            area: String(i.areaName ?? ""),
            areaId: i.areaId ? String(i.areaId) : undefined,
            senioridade: String(i.seniority ?? ""),
            funcionarios: typeof i.funcionariosCount === "number" ? i.funcionariosCount : 0,
            status: String(i.status ?? ""),
            description: i.description ? String(i.description) : undefined,
            updatedAtUtc: i.updatedAtUtc ? String(i.updatedAtUtc) : undefined,
        }));
        setRows(mapped);
        setScreenCache("/cargos", mapped);
    }, []);

    const loadAreas = useCallback(async () => {
        try {
            const payload = await fetchJson<unknown>(`/api/areas`);
            const items = Array.isArray(payload) ? (payload as AreaLookup[]) : Array.isArray((payload as Record<string, unknown>)?.items) ? ((payload as Record<string, unknown>).items as AreaLookup[]) : [];
            setAreas(items);
        } catch { /* optional */ }
    }, []);

    useEffect(() => {
        let alive = true;
        const cached = getScreenCache<CargoItem[]>("/cargos");
        if (cached && Array.isArray(cached)) {
            setRows(cached);
        } else {
            setLoading(true);
        }
        Promise.all([syncList(), loadAreas()])
            .catch((e) => { console.error("Cargos – load error", e); toast.error(`Falha ao carregar cargos: ${e instanceof Error ? e.message : "erro"}`); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList, loadAreas]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((c) => {
            const st = (c.status ?? "").toLowerCase();
            if (statusFilter === "ativo" && st !== "ativo" && st !== "active") return false;
            if (statusFilter === "inativo" && st !== "inativo" && st !== "inactive") return false;
            if (!qq) return true;
            return [c.codigo, c.nome, c.area, c.senioridade].filter(Boolean).join(" ").toLowerCase().includes(qq);
        });
    }, [q, rows, statusFilter]);

    /* pagination (client-side) */
    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, statusFilter],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

    /* KPIs — Razor: Cargos, Ativos, Funcionários, Headcount */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((c) => ["ativo", "active"].includes((c.status ?? "").toLowerCase())).length;
        const funcionarios = rows.reduce((s, c) => s + (c.funcionarios ?? c.gestores ?? 0), 0);
        const headcount = rows.reduce((s, c) => s + (c.headcount ?? 0), 0);
        return { total, active, funcionarios, headcount };
    }, [rows]);

    /* CRUD */
    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: CargoItem) {
        try {
            const detail = await fetchJson<Record<string, unknown>>(`/api/job-positions/${item.id}`);
            setDraft({
                id: item.id,
                code: String(detail?.code ?? detail?.Code ?? item.codigo ?? ""),
                name: String(detail?.name ?? detail?.Name ?? item.nome ?? ""),
                areaId: String(detail?.areaId ?? detail?.AreaId ?? item.areaId ?? "") || null,
                seniority: String(detail?.seniority ?? detail?.Seniority ?? item.senioridade ?? ""),
                status: String(detail?.status ?? item.status ?? "ativo"),
                tipo: String(detail?.tipo ?? detail?.Tipo ?? detail?.type ?? detail?.Type ?? item.tipo ?? ""),
                occupationalClassification: String(detail?.occupationalClassification ?? detail?.OccupationalClassification ?? ""),
                description: String(detail?.description ?? detail?.Description ?? ""),
                similarityIndicator: String(detail?.similarityIndicator ?? detail?.SimilarityIndicator ?? ""),
                fullDescription: String(detail?.fullDescription ?? detail?.FullDescription ?? ""),
                updatedAtUtc: detail?.updatedAtUtc ? String(detail.updatedAtUtc) : undefined,
            });
            setEditOpen(true);
        } catch { toast.error("Falha ao carregar dados."); }
    }

    async function saveDraft() {
        if (!draft.name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        const payload = {
            code: draft.code.trim() || null,
            name: draft.name.trim(),
            areaId: draft.areaId || null,
            seniority: draft.seniority.trim() || null,
            status: draft.status.toLowerCase() === "inativo" ? "Inactive" : "Active",
            tipo: draft.tipo.trim() || null,
            occupationalClassification: draft.occupationalClassification.trim() || null,
            description: draft.description.trim() || null,
            similarityIndicator: draft.similarityIndicator.trim().slice(0, 1) || null,
            fullDescription: draft.fullDescription.trim() || null,
        };
        try {
            if (draft.id) {
                await fetchJson(`/api/job-positions/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Cargo atualizado.");
            } else {
                await fetchJson(`/api/job-positions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Cargo criado.");
            }
            setEditOpen(false);
            await syncList();
        } catch { toast.error("Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function openDetail(item: CargoItem) {
        setDetailItem(item);
        setDetailFull(null);
        try {
            const d = await fetchJson<Record<string, unknown>>(`/api/job-positions/${item.id}`);
            setDetailFull(d);
        } catch { /* fall back to grid data */ }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`/api/job-positions/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Cargo excluído.");
            setDeleteTarget(null);
            await syncList();
        } catch { toast.error("Falha ao excluir."); }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: "array" });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
                if (!raw.length) { toast.error("Planilha vazia."); return; }

                const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const key = (r: Record<string, unknown>, variants: string[]) => {
                    const found = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v)));
                    return found ? String(r[found] ?? "").trim() : "";
                };

                const parsed: CargoDraft[] = raw.map((r) => {
                    const areaName = key(r, ["area", "area nome"]);
                    const areaMatch = areas.find((a) => a.name.toLowerCase() === areaName.toLowerCase());
                    const statusStr = key(r, ["status", "ativo"]).toLowerCase();
                    const isInactive = statusStr === "inativo" || statusStr === "inactive";
                    return {
                        code: key(r, ["codigo", "code"]),
                        name: key(r, ["cargo", "nome", "name"]),
                        areaId: areaMatch?.id ?? null,
                        seniority: key(r, ["senioridade", "seniority"]),
                        status: isInactive ? "inativo" : "ativo",
                        tipo: key(r, ["tipo", "type", "tipo do cargo"]),
                        occupationalClassification: key(r, [
                            "classificacao ocupacional", "classificacao", "occupational classification",
                            "cod_classific_ocupac", "occupationalclassification",
                        ]),
                        description: key(r, ["descricao", "description", "descricao resumida"]),
                        similarityIndicator: key(r, ["indicador similaridade", "similarity indicator", "idi_similaridad"]),
                        fullDescription: key(r, ["descricao completa", "full description", "dsl_complet_cargo", "descricao longa"]),
                    };
                }).map((r) => ({
                    ...r,
                    similarityIndicator: r.similarityIndicator ? r.similarityIndicator.slice(0, 1) : "",
                })).filter((r) => r.name);

                if (!parsed.length) { toast.error("Nenhuma linha com nome válido encontrada."); return; }
                setImportRows(parsed);
                setImportResult(null);
                setImportOpen(true);
            } catch (err) {
                console.error(err);
                toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const exportFilteredTsv = () => {
        const headers = ["codigo", "nome", "area", "senioridade", "status", "funcionarios", "descricao", "atualizacao"];
        const lines = filtered.map((c) =>
            [
                c.codigo,
                c.nome,
                c.area,
                c.senioridade,
                c.status,
                String(c.funcionarios ?? c.gestores ?? 0),
                c.description ?? "",
                c.updatedAtUtc ?? "",
            ].map((x) => escapeTsvCell(String(x))).join("\t"));
        const bom = "\uFEFF";
        const text = bom + [headers.join("\t"), ...lines].join("\n");
        const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cargos-${new Date().toISOString().slice(0, 10)}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Lista exportada (TSV).");
    };

    const runImport = async () => {
        if (!importRows.length) return;
        setImporting(true);
        const existingMap = new Map(rows.map((r) => [r.codigo.toLowerCase(), r.id]));
        let created = 0, updated = 0, errors = 0;
        for (const row of importRows) {
            const payload = {
                code: row.code || null,
                name: row.name,
                areaId: row.areaId || null,
                seniority: row.seniority || null,
                status: row.status === "inativo" ? "Inactive" : "Active",
                tipo: row.tipo || null,
                occupationalClassification: row.occupationalClassification || null,
                description: row.description || null,
                similarityIndicator: row.similarityIndicator ? row.similarityIndicator.slice(0, 1) : null,
                fullDescription: row.fullDescription || null,
            };
            try {
                const existingId = row.code ? existingMap.get(row.code.toLowerCase()) : undefined;
                if (existingId) {
                    await fetchJson(`/api/job-positions/${existingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                    updated++;
                } else {
                    await fetchJson(`/api/job-positions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                    created++;
                }
            } catch { errors++; }
        }
        setImportResult({ created, updated, errors });
        setImporting(false);
        await syncList();
    };

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Cargos</h4>
                    <div className="text-muted-foreground text-sm">Padronize cargos usados nos funcionários e vagas.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-4" /><span className="hidden sm:inline ml-1">Importar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportFilteredTsv} disabled={!filtered.length}>
                        <Download className="size-4" /><span className="hidden sm:inline ml-1">Exportar TSV</span>
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                    <Button size="sm" onClick={openNew}><Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo cargo</span></Button>
                </div>
            </div>

            {/* KPIs — 4 cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Cargos", value: kpis.total, color: "text-primary" },
                    { label: "Ativos", value: kpis.active, color: "text-emerald-600" },
                    { label: "Funcionários", value: kpis.funcionarios, color: "text-primary" },
                    { label: "Headcount", value: kpis.headcount, color: "text-primary" },
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
                    <div>
                        <div className="font-semibold">Lista de cargos</div>
                        <div className="text-muted-foreground text-sm">Clique em um cargo para ver funcionários vinculados.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, codigo, area..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                {/* Razor columns: Cargo, Area, Senioridade, Funcionários, Status, Ações */}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Senioridade</TableHead>
                            <TableHead>Funcionários</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Atualização</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : filtered.length ? paged.map((c) => (
                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => void openDetail(c)}>
                                <TableCell>
                                    <div className="font-semibold">{c.nome}</div>
                                    <div className="text-muted-foreground text-xs font-mono">{c.codigo || "—"}</div>
                                </TableCell>
                                <TableCell className="text-sm">{c.area || "—"}</TableCell>
                                <TableCell className="text-sm">{c.senioridade || "—"}</TableCell>
                                <TableCell className="font-mono text-sm">{c.funcionarios ?? c.gestores ?? 0}</TableCell>
                                <TableCell>{statusBadge(c.status)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                    {c.updatedAtUtc ? new Date(c.updatedAtUtc).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="outline" size="icon-xs" title="Editar" onClick={() => void openEdit(c)}><Pencil /></Button>
                                        <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(c)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum cargo encontrado.</TableCell></TableRow>
                        )}

                    </TableBody>
                </Table>
                <PaginationBar
                    page={page}
                    pageSize={pageSize}
                    totalItems={filtered.length}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            </div>

            {/* Edit/Create Dialog — Razor fields: Código, Cargo, Status, Área, Senioridade, Tipo, Descrição */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar cargo" : "Novo cargo"}</DialogTitle>
                        <DialogDescription>Cadastre dados principais do cargo.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Código do cargo *</label>
                            <Input placeholder="CAR-XXX" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do cargo *</label>
                            <Input placeholder="Ex.: Gerente de Produção" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Classificação Ocupacional</label>
                            <Input placeholder="Ex.: 0-00-00-00" value={draft.occupationalClassification} onChange={(e) => setDraft((d) => ({ ...d, occupationalClassification: e.target.value }))} maxLength={30} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo do cargo</label>
                            <Input placeholder="Operacional, Liderança, Administrativo" value={draft.tipo} onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Área</label>
                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.areaId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, areaId: e.target.value || null }))}>
                                <option value="">Selecionar área</option>
                                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Senioridade</label>
                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.seniority} onChange={(e) => setDraft((d) => ({ ...d, seniority: e.target.value }))}>
                                <option value="">Selecionar senioridade</option>
                                <option value="junior">Junior</option>
                                <option value="pleno">Pleno</option>
                                <option value="senior">Senior</option>
                                <option value="especialista">Especialista</option>
                                <option value="gestor">Gestor</option>
                            </select>
                        </div>
                        {draft.updatedAtUtc && (
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Última atualização</label>
                                <Input readOnly value={new Date(draft.updatedAtUtc).toLocaleString("pt-BR")} className="bg-muted cursor-default" />
                            </div>
                        )}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Indicador similaridade (1 caractere)</label>
                            <Input placeholder="Ex.: S" value={draft.similarityIndicator} maxLength={1} onChange={(e) => setDraft((d) => ({ ...d, similarityIndicator: e.target.value.slice(0, 1) }))} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição (resumo)</label>
                            <textarea
                                className={textareaClass}
                                placeholder="Resumo do escopo do cargo"
                                value={draft.description}
                                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                rows={2}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição completa (TOTVS)</label>
                            <textarea
                                className={textareaClass}
                                placeholder="Texto longo do cargo (até 500 caracteres)"
                                value={draft.fullDescription}
                                maxLength={500}
                                onChange={(e) => setDraft((d) => ({ ...d, fullDescription: e.target.value }))}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={() => void saveDraft()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) { setDetailItem(null); setDetailFull(null); } }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{detailItem?.nome || "Detalhes do cargo"}</DialogTitle>
                        <DialogDescription>
                            {detailItem?.codigo ? <span className="font-mono">{detailItem.codigo}</span> : "Informações detalhadas do cargo."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Código do cargo</p>
                            <p className="font-mono mt-0.5">{detailItem?.codigo || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Status</p>
                            <p className="mt-0.5">{detailItem ? statusBadge(detailItem.status) : "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Área</p>
                            <p className="mt-0.5">{detailItem?.area || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Senioridade</p>
                            <p className="mt-0.5">{detailItem?.senioridade || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Tipo do cargo</p>
                            <p className="mt-0.5">
                                {String(detailFull?.type ?? detailFull?.tipo ?? detailItem?.tipo ?? "") || "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Funcionários</p>
                            <p className="mt-0.5">{detailItem?.funcionarios ?? detailItem?.gestores ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Classificação Ocupacional</p>
                            <p className="mt-0.5 font-mono text-xs">
                                {!detailFull
                                    ? <span className="text-muted-foreground italic">carregando…</span>
                                    : String(detailFull.occupationalClassification ?? "") || "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Última atualização</p>
                            <p className="mt-0.5 text-xs">
                                {detailFull?.updatedAtUtc
                                    ? new Date(String(detailFull.updatedAtUtc)).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                    : detailItem?.updatedAtUtc
                                        ? new Date(detailItem.updatedAtUtc).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                        : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Indicador similaridade</p>
                            <p className="mt-0.5 font-mono text-xs">
                                {String(detailFull?.similarityIndicator ?? detailFull?.SimilarityIndicator ?? "") || "—"}
                            </p>
                        </div>
                        {String(detailFull?.description ?? detailItem?.description ?? "") !== "" && (
                            <div className="col-span-2">
                                <p className="text-xs font-medium text-muted-foreground">Descrição (resumo)</p>
                                <p className="mt-0.5 text-sm leading-relaxed">
                                    {String(detailFull?.description ?? detailItem?.description ?? "")}
                                </p>
                            </div>
                        )}
                        {String(detailFull?.fullDescription ?? (detailFull as Record<string, unknown> | null)?.FullDescription ?? "") !== "" && (
                            <div className="col-span-2">
                                <p className="text-xs font-medium text-muted-foreground">Descrição completa</p>
                                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                                    {String(detailFull?.fullDescription ?? (detailFull as Record<string, unknown> | null)?.FullDescription ?? "")}
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => { const item = detailItem; setDetailItem(null); setDetailFull(null); if (item) void openEdit(item); }} className="mr-auto">
                            <Pencil className="size-4 mr-1" /> Editar
                        </Button>
                        <Button variant="outline" onClick={() => { setDetailItem(null); setDetailFull(null); }}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) { setImportOpen(open); if (!open) { setImportRows([]); setImportResult(null); } } }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Importar Cargos</DialogTitle>
                        <DialogDescription>
                            {importResult
                                ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.`
                                : `${importRows.length} registro(s) encontrado(s). Cargos com código já existente serão atualizados.`}
                        </DialogDescription>
                    </DialogHeader>
                    {!importResult && (
                        <div className="max-h-64 overflow-y-auto border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Código</th>
                                        <th className="px-3 py-2 text-left font-medium">Nome</th>
                                        <th className="px-3 py-2 text-left font-medium">Área</th>
                                        <th className="px-3 py-2 text-left font-medium">Senioridade</th>
                                        <th className="px-3 py-2 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importRows.slice(0, 50).map((r, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="px-3 py-1.5 font-mono text-xs">{r.code || "—"}</td>
                                            <td className="px-3 py-1.5 font-medium">{r.name}</td>
                                            <td className="px-3 py-1.5 text-muted-foreground text-xs">{areas.find((a) => a.id === r.areaId)?.name || "—"}</td>
                                            <td className="px-3 py-1.5 text-muted-foreground text-xs">{r.seniority || "—"}</td>
                                            <td className="px-3 py-1.5">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.status !== "inativo" ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>
                                                    {r.status !== "inativo" ? "Ativo" : "Inativo"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {importRows.length > 50 && (
                                        <tr className="border-t"><td colSpan={5} className="px-3 py-2 text-center text-xs text-muted-foreground">… e mais {importRows.length - 50} registro(s)</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null); }} disabled={importing}>
                            {importResult ? "Fechar" : "Cancelar"}
                        </Button>
                        {!importResult && (
                            <Button onClick={() => void runImport()} disabled={importing}>
                                {importing ? "Importando..." : `Importar ${importRows.length} registro(s)`}
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
                        <DialogDescription>Excluir o cargo <strong>&quot;{deleteTarget?.nome}&quot;</strong>?</DialogDescription>
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
