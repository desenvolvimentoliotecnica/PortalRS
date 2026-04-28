"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Eye, Upload, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import { getScreenCache, setScreenCache } from "@/lib/screenCache";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmpresaAutocomplete } from "@/components/autocomplete/EmpresaAutocomplete";
import { ImportGuide } from "@/components/ImportGuide";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

/* ------------------------------------------------------------------ */
/*  Types – match the RHPortal.Api contracts                           */
/* ------------------------------------------------------------------ */

/** Matches UnitGridRowResponse from the API (PagedResult<UnitGridRowResponse>) */
interface UnitGridRow {
    id: string;
    name: string;
    code: string;
    status: number | string;  // API sends enum int (1=Active, 2=Inactive) or string
    headcount: number;
    email: string | null;
    phone: string | null;
    type: string | null;
    city: string | null;
    uf: string | null;
    addressLine: string | null;
    neighborhood: string | null;
    zipCode: string | null;
    responsibleName: string | null;
    notes: string | null;
    nomAbrevPessoaJurid: string | null;
    nomPessoaJurid: string | null;
    nomAbrevPessoaFisic: string | null;
    empresaId: string | null;
    empresaCode: string | null;
}

/** Matches UnitResponse from the API (GET by id, POST, PUT) */
interface UnitDetail extends UnitGridRow {
    createdAtUtc?: string;
    updatedAtUtc?: string;
    empresaDescription?: string | null;
}

interface PagedResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

interface UnidadeImportRow {
    empresaCodigo: string;
    code: string;
    name: string;
    status: string;
    headcount: number;
    type: string;
    email: string;
    phone: string;
    city: string;
    uf: string;
    zipCode: string;
    addressLine: string;
    neighborhood: string;
    responsibleName: string;
    nomAbrevPessoaJurid: string;
    nomPessoaJurid: string;
    nomAbrevPessoaFisic: string;
}

interface UnidadeDraft {
    id?: string;
    code: string;
    name: string;
    status: string;
    headcount: string;
    email: string;
    phone: string;
    type: string;
    city: string;
    uf: string;
    zipCode: string;
    addressLine: string;
    neighborhood: string;
    responsibleName: string;
    notes: string;
    nomAbrevPessoaJurid: string;
    nomPessoaJurid: string;
    nomAbrevPessoaFisic: string;
    empresaId: string | null;
    empresaCode: string | null;
    empresaDescription: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}: ${t || res.statusText}`;
        // Try to extract structured error
        try {
            const j = JSON.parse(t);
            if (j?.message) msg = j.message;
            else if (j?.detail) msg = j.detail;
            else if (j?.errors) {
                const parts = Object.entries(j.errors).flatMap(([k, v]) =>
                    Array.isArray(v) ? v.map((m: string) => `${k}: ${m}`) : [`${k}: ${v}`]
                );
                if (parts.length) msg = parts.join("; ");
            }
        } catch { /* not JSON */ }
        console.error(`[apiFetch] ${init?.method ?? "GET"} ${url} → ${msg}`);
        throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

/** Maps API status (int enum or string) to display label */
function mapStatus(s: number | string | null | undefined): "ativo" | "inativo" {
    if (typeof s === "number") return s === 1 ? "ativo" : "inativo";
    if (typeof s === "string") {
        const lower = s.toLowerCase();
        if (lower === "active" || lower === "ativo" || lower === "1") return "ativo";
    }
    return "inativo";
}

function statusBadge(s: number | string | null | undefined) {
    const st = mapStatus(s);
    if (st === "ativo")
        return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>;
    return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>;
}


const emptyDraft: UnidadeDraft = {
    code: "", name: "", status: "Active", headcount: "0",
    email: "", phone: "", type: "", city: "", uf: "", zipCode: "",
    addressLine: "", neighborhood: "", responsibleName: "", notes: "",
    nomAbrevPessoaJurid: "", nomPessoaJurid: "", nomAbrevPessoaFisic: "",
    empresaId: null, empresaCode: null, empresaDescription: null,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function UnidadesUnidadesTab() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<UnitGridRow[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<UnidadeDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UnitGridRow | null>(null);
    const [detailItem, setDetailItem] = useState<UnitGridRow | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importRows, setImportRows] = useState<UnidadeImportRow[]>([]);
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number } | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<PagedResponse<UnitGridRow>>("/api/units");
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setRows(items);
        setScreenCache("/unidades", items);
    }, []);

    useEffect(() => {
        let alive = true;
        const cached = getScreenCache<UnitGridRow[]>("/unidades");
        if (cached && Array.isArray(cached)) {
            setRows(cached);
        } else {
            setLoading(true);
        }
        syncList()
            .catch((e) => { console.error("Estabelecimentos – load error", e); toast.error(`Falha ao carregar estabelecimentos: ${e instanceof Error ? e.message : "erro"}`); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    type SortKey = "empresa" | "code" | "name" | "abrevPj" | "abrevPf" | "status";
    const [sortKey, setSortKey] = useState<SortKey>("code");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    function handleSort(key: SortKey) {
        if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    }
    function SortIcon({ col }: { col: SortKey }) {
        if (sortKey !== col) return <ChevronsUpDown className="inline size-3 ml-1 text-muted-foreground/50" />;
        return sortDir === "asc" ? <ChevronUp className="inline size-3 ml-1" /> : <ChevronDown className="inline size-3 ml-1" />;
    }

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        const f = rows.filter((u) => {
            const st = mapStatus(u.status);
            if (statusFilter === "ativo" && st !== "ativo") return false;
            if (statusFilter === "inativo" && st !== "inativo") return false;
            if (!qq) return true;
            return [u.name, u.code, u.city, u.email, u.type].filter(Boolean).join(" ").toLowerCase().includes(qq);
        });
        const dir = sortDir === "asc" ? 1 : -1;
        return [...f].sort((a, b) => {
            switch (sortKey) {
                case "empresa":  return dir * (a.empresaCode ?? "").localeCompare(b.empresaCode ?? "", "pt-BR");
                case "code":     return dir * a.code.localeCompare(b.code, "pt-BR");
                case "name":     return dir * a.name.localeCompare(b.name, "pt-BR");
                case "abrevPj":  return dir * (a.nomAbrevPessoaJurid ?? "").localeCompare(b.nomAbrevPessoaJurid ?? "", "pt-BR");
                case "abrevPf":  return dir * (a.nomAbrevPessoaFisic ?? "").localeCompare(b.nomAbrevPessoaFisic ?? "", "pt-BR");
                case "status":   return dir * mapStatus(a.status).localeCompare(mapStatus(b.status), "pt-BR");
                default: return 0;
            }
        });
    }, [q, rows, statusFilter, sortKey, sortDir]);

    /* pagination (client-side) */
    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, statusFilter, sortKey, sortDir],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

    /* KPIs */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((u) => mapStatus(u.status) === "ativo").length;
        const headcount = rows.reduce((s, u) => s + (u.headcount ?? 0), 0);
        return { total, active, headcount };
    }, [rows]);

    /* CRUD */
    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: UnitGridRow) {
        try {
            const d = await fetchJson<UnitDetail>(`/api/units/${item.id}`);
            setDraft({
                id: item.id,
                code: d?.code ?? item.code ?? "",
                name: d?.name ?? item.name ?? "",
                status: typeof d?.status === "number" ? (d.status === 1 ? "Active" : "Inactive") : String(d?.status ?? "Active"),
                headcount: String(d?.headcount ?? item.headcount ?? 0),
                email: d?.email ?? item.email ?? "",
                phone: d?.phone ?? item.phone ?? "",
                type: d?.type ?? item.type ?? "",
                city: d?.city ?? item.city ?? "",
                uf: d?.uf ?? item.uf ?? "",
                zipCode: d?.zipCode ?? item.zipCode ?? "",
                addressLine: d?.addressLine ?? item.addressLine ?? "",
                neighborhood: d?.neighborhood ?? item.neighborhood ?? "",
                responsibleName: d?.responsibleName ?? item.responsibleName ?? "",
                notes: d?.notes ?? item.notes ?? "",
                nomAbrevPessoaJurid: d?.nomAbrevPessoaJurid ?? item.nomAbrevPessoaJurid ?? "",
                nomPessoaJurid: d?.nomPessoaJurid ?? item.nomPessoaJurid ?? "",
                nomAbrevPessoaFisic: d?.nomAbrevPessoaFisic ?? item.nomAbrevPessoaFisic ?? "",
                empresaId: d?.empresaId ?? item.empresaId ?? null,
                empresaCode: d?.empresaCode ?? item.empresaCode ?? null,
                empresaDescription: d?.empresaDescription ?? null,
            });
            setEditOpen(true);
        } catch { toast.error("Falha ao carregar dados."); }
    }

    async function saveDraft() {
        if (!draft.empresaId) { toast.error("Empresa é obrigatória."); return; }
        if (!draft.name.trim()) { toast.error("Nome é obrigatório."); return; }
        if (!draft.code.trim()) { toast.error("Código é obrigatório."); return; }
        setSaving(true);

        const payload = {
            code: draft.code.trim(),
            name: draft.name.trim(),
            status: draft.status.toLowerCase() === "inactive" ? "Inactive" : "Active",
            headcount: parseInt(draft.headcount, 10) || 0,
            email: draft.email.trim() || null,
            phone: draft.phone.trim() || null,
            type: draft.type.trim() || null,
            city: draft.city.trim() || null,
            uf: draft.uf.trim() || null,
            zipCode: draft.zipCode.trim() || null,
            addressLine: draft.addressLine.trim() || null,
            neighborhood: draft.neighborhood.trim() || null,
            responsibleName: draft.responsibleName.trim() || null,
            notes: draft.notes.trim() || null,
            nomAbrevPessoaJurid: draft.nomAbrevPessoaJurid.trim() || null,
            nomPessoaJurid: draft.nomPessoaJurid.trim() || null,
            nomAbrevPessoaFisic: draft.nomAbrevPessoaFisic.trim() || null,
            empresaId: draft.empresaId || null,
        };

        try {
            if (draft.id) {
                await fetchJson(`/api/units/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Estabelecimento atualizado.");
            } else {
                await fetchJson("/api/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Estabelecimento criado.");
            }
            setEditOpen(false);
            await syncList();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`/api/units/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Estabelecimento excluído.");
            setDeleteTarget(null);
            await syncList();
        } catch (err) {
            // Extrai a mensagem do backend em caso de 409 (ex.: estabelecimento RM read-only).
            const raw = err instanceof Error ? err.message : String(err);
            const bodyStart = raw.indexOf(": ");
            const body = bodyStart >= 0 ? raw.slice(bodyStart + 2) : raw;
            let friendly = "Falha ao excluir.";
            try {
                const parsed = JSON.parse(body) as { message?: string };
                if (parsed?.message) friendly = parsed.message;
            } catch { /* não é JSON */ }
            toast.error(friendly, { duration: 8000 });
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array", cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // Preserve leading zeros and convert date cells to ISO strings
                if (sheet["!ref"]) {
                    const range = XLSX.utils.decode_range(sheet["!ref"]);
                    for (let R = range.s.r; R <= range.e.r; R++) {
                        for (let C = range.s.c; C <= range.e.c; C++) {
                            const ref = XLSX.utils.encode_cell({ r: R, c: C });
                            const cell = sheet[ref];
                            if (cell && cell.t === "d" && cell.v instanceof Date) { const d = cell.v as Date; cell.t = "s"; cell.v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
                            else if (cell && cell.t === "n") { cell.t = "s"; cell.v = cell.w ?? String(cell.v); }
                        }
                    }
                }
                const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
                if (raw.length === 0) { toast.error("Planilha vazia."); return; }
                const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const parsed: UnidadeImportRow[] = raw.map((r) => {
                    const key = (variants: string[]) => { const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v))); return f ? String(r[f] ?? "").trim() : ""; };
                    const statusStr = key(["status", "ativo", "ativa"]).toLowerCase();
                    return {
                        empresaCodigo: key(["empresacodigo", "empresacod", "cdn_empresa", "empresa"]),
                        code: key(["codigo", "code", "cdn_estab"]),
                        name: key(["nome", "name", "estabelecimento", "nom_pessoa_jurid"]),
                        status: statusStr === "inativo" || statusStr === "inactive" ? "Inactive" : "Active",
                        headcount: parseInt(key(["headcount", "colaboradores", "funcionarios"]), 10) || 0,
                        type: key(["tipo", "type"]),
                        email: key(["email"]),
                        phone: key(["telefone", "phone", "fone"]),
                        city: key(["cidade", "city"]),
                        uf: key(["uf", "estado", "state"]),
                        zipCode: key(["cep", "zipcode", "zip"]),
                        addressLine: key(["endereco", "address", "logradouro"]),
                        neighborhood: key(["bairro", "neighborhood"]),
                        responsibleName: key(["responsavel", "responsible", "responsavel name"]),
                        nomAbrevPessoaJurid: key(["nomabrevpessoajurid", "nom_abrev_pessoa_jurid", "abrev"]),
                        nomPessoaJurid: key(["nompessoajurid", "nom_pessoa_jurid"]),
                        nomAbrevPessoaFisic: key(["nomabrevpessoafisic", "nom_abrev_pessoa_fisic"]),
                    };
                }).filter((r) => r.empresaCodigo && r.code && r.name);
                if (parsed.length === 0) { toast.error("Nenhuma linha válida encontrada."); return; }
                setImportRows(parsed); setImportResult(null); setImportOpen(true);
            } catch { toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv."); }
        };
        reader.readAsArrayBuffer(file);
    }

    async function runImport() {
        if (importRows.length === 0) return;
        setImporting(true);

        // Resolve empresa ERP code → internal id
        let empresaByCode = new Map<string, string>();
        try {
            const empresas = await fetchJson<Array<{ id: string; code: string }>>("/api/empresas?take=500");
            empresaByCode = new Map(empresas.map((e) => [e.code.toLowerCase(), e.id]));
        } catch {
            toast.error("Falha ao carregar empresas"); setImporting(false); return;
        }

        // Fresh fetch of all existing units to build upsert map
        let allUnits: UnitGridRow[] = [];
        try {
            const res = await fetchJson<PagedResponse<UnitGridRow>>("/api/units?pageSize=5000");
            allUnits = Array.isArray(res?.items) ? res.items : [];
        } catch { toast.error("Falha ao carregar estabelecimentos"); setImporting(false); return; }
        // Key: empresaCodigo|code (ERP codes, case-insensitive)
        const existingMap = new Map(
            allUnits.filter((r) => r.empresaCode).map((r) => [`${r.empresaCode!.toLowerCase()}|${r.code.toLowerCase()}`, r.id])
        );

        let created = 0, updated = 0, errors = 0;

        const validRows = importRows.map((row) => {
            const empresaId = empresaByCode.get(row.empresaCodigo.toLowerCase()) ?? null;
            if (!empresaId) return null;
            const payload = {
                code: row.code, name: row.name, status: row.status,
                headcount: row.headcount, type: row.type || null,
                email: row.email || null, phone: row.phone || null,
                city: row.city || null, uf: row.uf || null,
                zipCode: row.zipCode || null, addressLine: row.addressLine || null,
                neighborhood: row.neighborhood || null, responsibleName: row.responsibleName || null,
                notes: null, empresaId,
                nomAbrevPessoaJurid: row.nomAbrevPessoaJurid || null,
                nomPessoaJurid: row.nomPessoaJurid || null,
                nomAbrevPessoaFisic: row.nomAbrevPessoaFisic || null,
            };
            const existingId = existingMap.get(`${row.empresaCodigo.toLowerCase()}|${row.code.toLowerCase()}`);
            return { payload, existingId };
        });
        errors += validRows.filter((r) => r === null).length;

        const BATCH = 20;
        const nonNull = validRows.filter((r) => r !== null) as { payload: object; existingId: string | undefined }[];
        for (let i = 0; i < nonNull.length; i += BATCH) {
            const batch = nonNull.slice(i, i + BATCH);
            const results = await Promise.allSettled(
                batch.map(({ payload, existingId }) => {
                    if (existingId) return fetchJson(`/api/units/${existingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(() => "updated" as const);
                    return fetchJson("/api/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(() => "created" as const);
                })
            );
            for (const r of results) {
                if (r.status === "fulfilled") { if (r.value === "updated") updated++; else created++; }
                else errors++;
            }
        }
        setImportResult({ created, updated, errors });
        setImporting(false);
        await syncList();
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-bold">Estabelecimentos</h4>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-4" /><span className="hidden sm:inline ml-1">Importar</span>
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                    <Button variant="outline" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}><Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo estabelecimento</span></Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Estabelecimentos", value: kpis.total, color: "text-primary" },
                    { label: "Ativas", value: kpis.active, color: "text-emerald-600" },
                    { label: "Headcount", value: kpis.headcount, color: "text-primary" },
                    { label: "Vagas abertas", value: 0, color: "text-primary" },
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
                        <div className="font-semibold">Lista de estabelecimentos</div>
                        <div className="text-muted-foreground text-sm">Clique em um estabelecimento para ver funcionários e vagas.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, codigo, cidade..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("empresa")}>Empresa<SortIcon col="empresa" /></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("code")}>Código<SortIcon col="code" /></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>Nome<SortIcon col="name" /></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("abrevPj")}>Abrev. PJ<SortIcon col="abrevPj" /></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("abrevPf")}>Abrev. PF<SortIcon col="abrevPf" /></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : filtered.length ? paged.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-mono font-medium">{u.empresaCode || "—"}</TableCell>
                                <TableCell className="font-mono font-medium">{u.code}</TableCell>
                                <TableCell>{u.name}</TableCell>
                                <TableCell>{u.nomAbrevPessoaJurid || "—"}</TableCell>
                                <TableCell>{u.nomAbrevPessoaFisic || "—"}</TableCell>
                                <TableCell>{statusBadge(u.status)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="outline" size="icon-xs" title="Detalhes" onClick={() => setDetailItem(u)}><Eye /></Button>
                                        <Button variant="outline" size="icon-xs" title="Editar" onClick={() => void openEdit(u)}><Pencil /></Button>
                                        <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(u)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum estabelecimento encontrado.</TableCell></TableRow>
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

            {/* Edit/Create Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar estabelecimento" : "Novo estabelecimento"}</DialogTitle>
                        <DialogDescription>Cadastre dados do estabelecimento.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa *</label>
                            <EmpresaAutocomplete
                                value={draft.empresaId}
                                onChange={(id) => setDraft((d) => ({ ...d, empresaId: id }))}
                                defaultLabel={draft.empresaCode && draft.empresaDescription ? { code: draft.empresaCode, description: draft.empresaDescription } : undefined}
                                placeholder="Selecione a empresa..."
                            />
                        </div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label><Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">nom_pessoa_jurid</label><Input value={draft.nomPessoaJurid} onChange={(e) => setDraft((d) => ({ ...d, nomPessoaJurid: e.target.value }))} maxLength={150} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">nom_abrev_pessoa_jurid</label><Input value={draft.nomAbrevPessoaJurid} onChange={(e) => setDraft((d) => ({ ...d, nomAbrevPessoaJurid: e.target.value }))} maxLength={60} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">nom_abrev_pessoa_fisic</label><Input value={draft.nomAbrevPessoaFisic} onChange={(e) => setDraft((d) => ({ ...d, nomAbrevPessoaFisic: e.target.value }))} maxLength={60} /></div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="Active">Ativo</option>
                                <option value="Inactive">Inativo</option>
                            </select>
                        </div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Headcount</label><Input type="number" value={draft.headcount} onChange={(e) => setDraft((d) => ({ ...d, headcount: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label><Input placeholder="Matriz, Filial..." value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label><Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label><Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Responsável</label><Input value={draft.responsibleName} onChange={(e) => setDraft((d) => ({ ...d, responsibleName: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Endereço</label><Input value={draft.addressLine} onChange={(e) => setDraft((d) => ({ ...d, addressLine: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Bairro</label><Input value={draft.neighborhood} onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Cidade</label><Input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">UF</label><Input maxLength={2} value={draft.uf} onChange={(e) => setDraft((d) => ({ ...d, uf: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">CEP</label><Input value={draft.zipCode} onChange={(e) => setDraft((d) => ({ ...d, zipCode: e.target.value }))} /></div>
                        <div className="sm:col-span-3"><label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label><Input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={() => void saveDraft()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalhes — {detailItem?.name}</DialogTitle>
                        <DialogDescription>Funcionários e vagas desta unidade.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Código:</span> {detailItem?.code || "—"}</div>
                        <div><span className="font-medium">Status:</span> {detailItem ? statusBadge(detailItem.status) : ""}</div>
                        <div><span className="font-medium">Headcount:</span> {detailItem?.headcount ?? 0}</div>
                        <div><span className="font-medium">Tipo:</span> {detailItem?.type || "—"}</div>
                        <div><span className="font-medium">Contato:</span> {detailItem?.email || "—"} / {detailItem?.phone || "—"}</div>
                        <div><span className="font-medium">Responsável:</span> {detailItem?.responsibleName || "—"}</div>
                        <div><span className="font-medium">Local:</span> {[detailItem?.city, detailItem?.uf].filter(Boolean).join(" - ") || "—"}</div>
                        <div><span className="font-medium">Endereço:</span> {detailItem?.addressLine || "—"}</div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailItem(null)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) { setImportOpen(open); if (!open) { setImportRows([]); setImportResult(null); } } }}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Importar Estabelecimentos</DialogTitle>
                        <DialogDescription>
                            {importResult
                                ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.`
                                : `${importRows.length} registro(s) encontrado(s). Códigos existentes serão atualizados.`}
                        </DialogDescription>
                    </DialogHeader>
                    <ImportGuide entity="Estabelecimentos" columns={[
                        { name: "EmpresaCodigo", hint: "Ex: 1 (cdn_empresa)", required: true },
                        { name: "Codigo", hint: "Ex: 1 (cdn_estab)", required: true },
                        { name: "Nome", hint: "Ex: Filial São Paulo (nom_pessoa_jurid)", required: true },
                        { name: "NomAbrevPessoaJurid", hint: "Abrev. razão social" },
                        { name: "NomAbrevPessoaFisic", hint: "Abrev. nome fantasia / pessoa física" },
                        { name: "NomPessoaJurid", hint: "Razão social completa" },
                        { name: "Tipo", hint: "Ex: Matriz, Filial" },
                        { name: "Email", hint: "Ex: filial@empresa.com.br" },
                        { name: "Telefone", hint: "Ex: (11) 9999-9999" },
                        { name: "Cidade", hint: "Ex: São Paulo" },
                        { name: "UF", hint: "Ex: SP" },
                        { name: "CEP", hint: "Ex: 01310-100" },
                        { name: "Endereco", hint: "Ex: Av. Paulista, 1000" },
                        { name: "Bairro", hint: "Ex: Bela Vista" },
                        { name: "Responsavel", hint: "Nome do responsável" },
                        { name: "Headcount", hint: "Ex: 50" },
                        { name: "Status", hint: "Ativo / Inativo" },
                    ]} />
                    {!importResult && (
                        <div className="max-h-64 overflow-y-auto border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Empresa</th>
                                        <th className="px-3 py-2 text-left font-medium">Código</th>
                                        <th className="px-3 py-2 text-left font-medium">Nome</th>
                                        <th className="px-3 py-2 text-left font-medium">Abrev. Razão Social</th>
                                        <th className="px-3 py-2 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importRows.slice(0, 50).map((r, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.empresaCodigo}</td>
                                            <td className="px-3 py-1.5 font-mono">{r.code}</td>
                                            <td className="px-3 py-1.5">{r.name}</td>
                                            <td className="px-3 py-1.5 text-muted-foreground">{r.nomAbrevPessoaJurid || "—"}</td>
                                            <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "Active" ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>{r.status === "Active" ? "Ativo" : "Inativo"}</span></td>
                                        </tr>
                                    ))}
                                    {importRows.length > 50 && <tr className="border-t"><td colSpan={5} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {importRows.length - 50} registro(s)</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null); }} disabled={importing}>{importResult ? "Fechar" : "Cancelar"}</Button>
                        {!importResult && <Button onClick={() => void runImport()} disabled={importing}>{importing ? "Importando…" : `Importar ${importRows.length} registro(s)`}</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>Excluir o estabelecimento <strong>&quot;{deleteTarget?.name}&quot;</strong>?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => void confirmDelete()}>Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function UnidadesScreen() {
    return (
        <section className="space-y-4">
            <UnidadesUnidadesTab />
        </section>
    );
}
