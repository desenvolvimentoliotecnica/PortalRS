"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Download, Upload, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportGuide } from "@/components/ImportGuide";
import { EmpresaAutocomplete } from "@/components/autocomplete/EmpresaAutocomplete";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

interface Item {
  id: string;
  code: string;
  description: string;
  manager?: string;
  notes?: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  empresaId?: string | null;
  empresaCode?: string | null;
  empresaDescription?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  parentId?: string | null;
  parentCode?: string | null;
  parentDescription?: string | null;
  // Campos absorvidos de Department/Area (Sessão 31.2)
  headcount?: number;
  phone?: string | null;
  branchOrLocation?: string | null;
  ownerFuncionarioId?: string | null;
  ownerFuncionarioName?: string | null;
  description2?: string | null;
}

interface Draft {
  id?: string;
  code: string;
  description: string;
  manager: string;
  notes: string;
  isActive: boolean;
  empresaId: string | null;
  empresaCode: string | null;
  empresaDescription: string | null;
  validFrom: string;
  validUntil: string;
  parentId: string;
  // Campos absorvidos de Department/Area (Sessão 31.2)
  headcount: string;
  phone: string;
  branchOrLocation: string;
  ownerFuncionarioId: string | null;
  ownerFuncionarioName: string | null;
  description2: string;
}

interface FuncionarioLookup {
  id: string;
  name: string;
}

interface ImportRow {
  empresaCodigo: string;
  code: string;
  description: string;
  manager: string;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status}: ${t || res.statusText}`); }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function statusBadge(active: boolean) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>
  );
}

const emptyDraft: Draft = {
  code: "", description: "", manager: "", notes: "", isActive: true,
  empresaId: null, empresaCode: null, empresaDescription: null,
  validFrom: "", validUntil: "", parentId: "",
  headcount: "", phone: "", branchOrLocation: "",
  ownerFuncionarioId: null, ownerFuncionarioName: null,
  description2: "",
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return s;
}

export default function CentroCustoCadastroScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioLookup[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<keyof Item>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number } | null>(null);

  const syncList = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchJson<Item[]>("/api/centros-custo?take=5000");
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Erro ao carregar centros de custo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncList(); }, [syncList]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJson<{ items: Array<{ id: string; nome: string }> }>("/api/lookup/funcionarios?pageSize=200&onlyActive=true");
        const items = Array.isArray(data?.items) ? data.items : [];
        setFuncionarios(items.map((f) => ({ id: f.id, name: f.nome })));
      } catch {
        setFuncionarios([]);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((x) => {
      if (statusFilter === "ativo" && !x.isActive) return false;
      if (statusFilter === "inativo" && x.isActive) return false;
      if (!q) return true;
      return x.code.toLowerCase().includes(q) || x.description.toLowerCase().includes(q);
    });
  }, [search, statusFilter, rows]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // 31.2: headcount é number — usa comparação numérica para não ordenar "9" > "10" como string
      if (typeof av === "number" || typeof bv === "number") {
        const an = typeof av === "number" ? av : 0;
        const bn = typeof bv === "number" ? bv : 0;
        return sortDir === "asc" ? an - bn : bn - an;
      }
      const as = (av ?? "").toString();
      const bs = (bv ?? "").toString();
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: keyof Item) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: keyof Item }) => {
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline size-3 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="ml-1 inline size-3" /> : <ChevronDown className="ml-1 inline size-3" />;
  };

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(sorted.length, {
    initialPageSize: 20,
    resetDeps: [search, statusFilter, sortKey, sortDir],
  });
  const paged = useMemo(() => sorted.slice(slice.start, slice.end), [sorted, slice.start, slice.end]);

  const kpis = useMemo(() => ({
    total: rows.length,
    ativos: rows.filter((r) => r.isActive).length,
    headcountTotal: rows.reduce((acc, r) => acc + (r.headcount ?? 0), 0),
  }), [rows]);

  const save = async () => {
    if (!draft.empresaId) { toast.error("Empresa é obrigatória"); return; }
    if (!draft.code.trim() || !draft.description.trim()) { toast.error("Código e descrição são obrigatórios"); return; }
    try {
      setSaving(true);
      const headcountNum = draft.headcount ? Math.max(0, parseInt(draft.headcount, 10) || 0) : 0;
      const payload = {
        code: draft.code.trim(),
        description: draft.description.trim(),
        manager: draft.manager?.trim() || null,
        notes: draft.notes?.trim() || null,
        isActive: draft.isActive,
        empresaId: draft.empresaId,
        validFrom: draft.validFrom || null,
        validUntil: draft.validUntil || null,
        parentId: draft.parentId || null,
        // Campos absorvidos de Department/Area (Sessão 31.2)
        headcount: headcountNum,
        phone: draft.phone?.trim() || null,
        branchOrLocation: draft.branchOrLocation?.trim() || null,
        ownerFuncionarioId: draft.ownerFuncionarioId || null,
        description2: draft.description2?.trim() || null,
      };
      if (draft.id) {
        await fetchJson(`/api/centros-custo/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Centro de Custo atualizado");
      } else {
        await fetchJson("/api/centros-custo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Centro de Custo criado");
      }
      setEditOpen(false);
      await syncList();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar centro de custo"); }
    finally { setSaving(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (sheet["!ref"]) { const range = XLSX.utils.decode_range(sheet["!ref"]); for (let R = range.s.r; R <= range.e.r; R++) { for (let C = range.s.c; C <= range.e.c; C++) { const ref = XLSX.utils.encode_cell({ r: R, c: C }); const cell = sheet[ref]; if (cell && cell.t === "d" && cell.v instanceof Date) { const d = cell.v as Date; cell.t = "s"; cell.v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; } else if (cell && cell.t === "n") { cell.t = "s"; cell.v = cell.w ?? String(cell.v); } } } }
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (raw.length === 0) { toast.error("Planilha vazia."); return; }
        const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const parsed: ImportRow[] = raw.map((r) => {
          const key = (variants: string[]) => { const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v))); return f ? String(r[f] ?? "").trim() : ""; };
          const statusStr = key(["status", "ativo", "ativa"]).toLowerCase();
          return {
            empresaCodigo: key(["empresacodigo", "empresacod", "cdn_empresa", "empresa"]),
            code: key(["codigo", "code", "cdn_ccusto"]),
            description: key(["descricao", "description", "des_ccusto"]),
            manager: key(["responsavel", "manager"]),
            isActive: statusStr !== "inativo" && statusStr !== "inactive",
            validFrom: key(["datainicio", "dataini", "dat_ini_valid", "inicio", "validfrom"]),
            validUntil: key(["datafim", "dat_fim_valid", "fim", "validuntil"]),
          };
        }).filter((r) => r.empresaCodigo && r.code && r.description);
        if (parsed.length === 0) { toast.error("Nenhuma linha válida encontrada."); return; }
        setImportRows(parsed); setImportResult(null); setImportOpen(true);
      } catch { toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const payload = importRows.map((row) => ({
        code: row.code,
        description: row.description,
        manager: row.manager || null,
        isActive: row.isActive,
        empresaCodigo: row.empresaCodigo || null,
        validFrom: row.validFrom || null,
        validUntil: row.validUntil || null,
      }));
      const result = await fetchJson<{ created: number; updated: number; skipped: number; errors: string[] }>(
        "/api/centros-custo/import",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      setImportResult({ created: result.created, updated: result.updated, errors: result.skipped + result.errors.length });
      await syncList();
    } catch (e) {
      toast.error(`Falha na importação: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setImporting(false);
    }
  };

  const exportTsv = () => {
    const csv = [["Código", "Descrição", "Responsável", "Status"].join("\t"),
      ...rows.map((x) => [x.code, x.description, x.manager || "", x.isActive ? "Ativo" : "Inativo"].join("\t"))
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/plain;charset=utf-8;" }));
    link.download = "centros-custo.tsv";
    link.click();
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Centros de Custo</h4>
          <div className="text-muted-foreground text-sm">Cadastro unificado — absorveu Áreas e Departamentos (Sessão 31.2).</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportTsv} title="Exportar">
            <Download className="size-4" /><span className="hidden sm:inline ml-1">Exportar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title="Importar">
            <Upload className="size-4" /><span className="hidden sm:inline ml-1">Importar</span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}>
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo centro</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativos", value: kpis.ativos, color: "text-emerald-600" },
          { label: "Inativos", value: kpis.total - kpis.ativos, color: "text-zinc-500" },
          { label: "Headcount total", value: kpis.headcountTotal, color: "text-blue-600" },
          { label: "Exibindo", value: filtered.length, color: "text-primary" },
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
            <div className="font-semibold">Lista de centros de custo</div>
            <div className="text-muted-foreground text-sm">Clique em Editar para alterar um registro.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-[220px] pl-8" placeholder="código, descrição..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("empresaCode")}>Empresa<SortIcon col="empresaCode" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("code")}>Código<SortIcon col="code" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("description")}>Descrição<SortIcon col="description" /></TableHead>
              <TableHead>Pai</TableHead>
              {/* 31.2: colunas herdadas de Area + Department */}
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("headcount")}>Headcount<SortIcon col="headcount" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ownerFuncionarioName")}>Responsável<SortIcon col="ownerFuncionarioName" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("branchOrLocation")}>Filial/Local<SortIcon col="branchOrLocation" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("validFrom")}>Data Início<SortIcon col="validFrom" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("validUntil")}>Data Fim<SortIcon col="validUntil" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("isActive")}>Status<SortIcon col="isActive" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => {
              const today = new Date().toISOString().slice(0, 10);
              const isExpired = !!item.validUntil && item.validUntil < today;
              // 31.2: Responsável prefere OwnerFuncionario (novo vínculo) e cai para Manager (campo legado livre)
              const responsavel = item.ownerFuncionarioName || item.manager || null;
              return (
              <TableRow key={item.id}>
                <TableCell className="text-sm text-muted-foreground font-mono">{item.empresaCode || "—"}</TableCell>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell className="text-sm">{item.description}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{item.parentCode ? `${item.parentCode}` : <span className="italic">—</span>}</TableCell>
                <TableCell className="text-sm text-right font-mono">{item.headcount ?? 0}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{responsavel || <span className="italic">—</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.branchOrLocation || <span className="italic">—</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(item.validFrom) || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDate(item.validUntil) || "—"}
                  {isExpired && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">Expirado</span>
                  )}
                </TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => {
                      setDraft({
                        id: item.id,
                        code: item.code,
                        description: item.description,
                        manager: item.manager || "",
                        notes: item.notes || "",
                        isActive: item.isActive,
                        empresaId: item.empresaId ?? null,
                        empresaCode: item.empresaCode ?? null,
                        empresaDescription: item.empresaDescription ?? null,
                        validFrom: item.validFrom ?? "",
                        validUntil: item.validUntil ?? "",
                        parentId: item.parentId ?? "",
                        headcount: item.headcount != null ? String(item.headcount) : "",
                        phone: item.phone ?? "",
                        branchOrLocation: item.branchOrLocation ?? "",
                        ownerFuncionarioId: item.ownerFuncionarioId ?? null,
                        ownerFuncionarioName: item.ownerFuncionarioName ?? null,
                        description2: item.description2 ?? "",
                      });
                      setEditOpen(true);
                    }}>
                      <Pencil />
                    </Button>
                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            }) : (
              <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Nenhum centro de custo encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={sorted.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar centro de custo" : "Novo centro de custo"}</DialogTitle>
            <DialogDescription>Preencha os dados do centro de custo.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa *</label>
              <EmpresaAutocomplete
                value={draft.empresaId}
                onChange={(id) => setDraft((d) => ({ ...d, empresaId: id }))}
                defaultLabel={draft.empresaCode && draft.empresaDescription ? { code: draft.empresaCode, description: draft.empresaDescription } : undefined}
                placeholder="Selecione a empresa..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input placeholder="Ex: CC001" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={30} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição *</label>
              <Input placeholder="Ex: Administrativo" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={120} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Responsável</label>
              <Input placeholder="Nome do responsável" value={draft.manager} onChange={(e) => setDraft((d) => ({ ...d, manager: e.target.value }))} maxLength={120} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Data início vigência</label>
              <Input type="date" value={draft.validFrom} onChange={(e) => setDraft((d) => ({ ...d, validFrom: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Data fim vigência</label>
              <Input type="date" value={draft.validUntil} onChange={(e) => setDraft((d) => ({ ...d, validUntil: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.isActive ? "ativo" : "inativo"} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "ativo" }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Centro de custo pai (hierarquia)</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.parentId} onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value }))}>
                <option value="">— Raiz —</option>
                {rows.filter((r) => r.id !== draft.id).map((r) => (
                  <option key={r.id} value={r.id}>{r.code} — {r.description}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Deixe vazio para CC raiz. O backend rejeita ciclos.</p>
            </div>

            {/* ── Campos absorvidos de Department (Sessão 31.2) ── */}
            <div className="sm:col-span-2 pt-2 border-t border-border/40 mt-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Unidade operacional</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Headcount planejado</label>
              <Input type="number" min={0} placeholder="Ex: 10" value={draft.headcount} onChange={(e) => setDraft((d) => ({ ...d, headcount: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label>
              <Input placeholder="(11) 99999-9999" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} maxLength={40} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Filial / Localização física</label>
              <Input placeholder="Ex: Filial São Paulo — Andar 5" value={draft.branchOrLocation} onChange={(e) => setDraft((d) => ({ ...d, branchOrLocation: e.target.value }))} maxLength={160} />
            </div>

            {/* ── Campos absorvidos de Area (Sessão 31.2) ── */}
            <div className="sm:col-span-2 pt-2 border-t border-border/40 mt-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dono organizacional</div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Funcionário responsável</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.ownerFuncionarioId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, ownerFuncionarioId: e.target.value || null }))}>
                <option value="">— Nenhum —</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Opcional. Vínculo com Funcionario (delete SET NULL).</p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição detalhada</label>
              <textarea className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Descrição complementar (opcional)" value={draft.description2} onChange={(e) => setDraft((d) => ({ ...d, description2: e.target.value }))} maxLength={1000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) { setImportOpen(open); if (!open) { setImportRows([]); setImportResult(null); } } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Centros de Custo</DialogTitle>
            <DialogDescription>
              {importResult ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.` : `${importRows.length} registro(s) encontrado(s). Códigos existentes serão atualizados.`}
            </DialogDescription>
          </DialogHeader>
          <ImportGuide entity="CentrosCusto" columns={[
            { name: "EmpresaCodigo", hint: "Ex: 1 (código ERP)", required: true },
            { name: "Codigo", hint: "Ex: CC01 (cdn_ccusto)", required: true },
            { name: "Descricao", hint: "Ex: TI - Infraestrutura", required: true },
            { name: "Responsavel", hint: "Nome do gestor" },
            { name: "DataInicio", hint: "Ex: 2024/01/01 (dat_ini_valid)" },
            { name: "DataFim", hint: "Ex: 2025/12/31 (dat_fim_valid)" },
            { name: "Status", hint: "Ativo / Inativo" },
          ]} />
          {!importResult && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium">Vigência</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.empresaCodigo}</td>
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">{fmtDate(r.validFrom) || "—"} → {fmtDate(r.validUntil) || "∞"}</td>
                      <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>{r.isActive ? "Ativo" : "Inativo"}</span></td>
                    </tr>
                  ))}
                  {importRows.length > 50 && <tr className="border-t"><td colSpan={5} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {importRows.length - 50} registro(s)</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null); }} disabled={importing}>{importResult ? "Fechar" : "Cancelar"}</Button>
            {!importResult && <Button onClick={runImport} disabled={importing}>{importing ? "Importando…" : `Importar ${importRows.length} registro(s)`}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Excluir o centro de custo <strong>"{deleteTarget?.description}"</strong>? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!deleteTarget) return;
              try {
                await fetchJson(`/api/centros-custo/${deleteTarget.id}`, { method: "DELETE" });
                toast.success("Centro de custo removido");
                setDeleteTarget(null);
                await syncList();
              } catch (err) {
                // Extrai a mensagem do backend quando o endpoint retorna 409 Conflict
                // com body { message, dependencies }. fetchJson joga Error cuja mensagem
                // é "HTTP 409: {json}" — parseamos a parte após o primeiro ": ".
                const raw = err instanceof Error ? err.message : String(err);
                const bodyStart = raw.indexOf(": ");
                const body = bodyStart >= 0 ? raw.slice(bodyStart + 2) : raw;
                let friendly = raw;
                try {
                  const parsed = JSON.parse(body) as { message?: string };
                  if (parsed?.message) friendly = parsed.message;
                } catch { /* body não é JSON — usa raw */ }
                toast.error(friendly, { duration: 8000 });
              }
            }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
