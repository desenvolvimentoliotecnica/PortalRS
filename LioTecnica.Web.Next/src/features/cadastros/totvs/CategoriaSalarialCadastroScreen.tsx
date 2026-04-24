"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Download, Upload, ChevronUp, ChevronDown, ChevronsUpDown, X, Wand2 } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportGuide } from "@/components/ImportGuide";
import { EmpresaAutocomplete } from "@/components/autocomplete/EmpresaAutocomplete";
import { EstabelecimentoAutocomplete } from "@/components/autocomplete/EstabelecimentoAutocomplete";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

interface StepResponse {
  id: string;
  percentual: number;
  valorOverride: number | null;
  ordem: number;
  observacao: string | null;
  valorEfetivo: number | null;
}

interface Item {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  valorBase: number | null;
  empresaId?: string | null;
  empresaCode?: string | null;
  estabelecimentoId?: string | null;
  estabelecimentoCode?: string | null;
  estabelecimentoName?: string | null;
  steps?: StepResponse[];
}

interface StepDraft {
  /** inputs são strings pra preservar digitação parcial (ex: "80.", "12") */
  percentual: string;
  valorOverride: string;
  ordem: number;
  observacao: string;
}

interface Draft {
  id?: string;
  code: string;
  description: string;
  isActive: boolean;
  valorBase: string;
  empresaId: string | null;
  empresaCode: string | null;
  empresaDescription: string | null;
  estabelecimentoId: string | null;
  estabelecimentoCode: string | null;
  estabelecimentoName: string | null;
  steps: StepDraft[];
}

interface ImportRow {
  empresaCodigo: string;
  estabelecimentoCodigo: string;
  code: string;
  description: string;
  valorBase: string;
  isActive: boolean;
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
  code: "", description: "", isActive: true,
  valorBase: "",
  empresaId: null, empresaCode: null, empresaDescription: null,
  estabelecimentoId: null, estabelecimentoCode: null, estabelecimentoName: null,
  steps: [],
};

/** Gera grade padrão 80%, 85%, 90%, ..., 120% (passo de 5). Observação vazia por default. */
function defaultGrid(): StepDraft[] {
  const steps: StepDraft[] = [];
  let ordem = 0;
  for (let p = 80; p <= 120; p += 5) {
    steps.push({ percentual: String(p), valorOverride: "", ordem, observacao: "" });
    ordem += 1;
  }
  return steps;
}

function parseDecimal(s: string): number | null {
  if (!s || !s.trim()) return null;
  // Aceita "," ou "." como separador decimal (BR)
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CategoriaSalarialCadastroScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
      const items = await fetchJson<Item[]>("/api/categorias-salariais?take=5000");
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Erro ao carregar categorias salariais");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncList(); }, [syncList]);

  type SortKey = "empresa" | "estab" | "code" | "description" | "valorBase" | "status";
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
    const q = search.trim().toLowerCase();
    const f = rows.filter((x) => {
      if (statusFilter === "ativo" && !x.isActive) return false;
      if (statusFilter === "inativo" && x.isActive) return false;
      if (!q) return true;
      return x.code.toLowerCase().includes(q) || x.description.toLowerCase().includes(q);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      switch (sortKey) {
        case "empresa":     return dir * (a.empresaCode ?? "").localeCompare(b.empresaCode ?? "", "pt-BR");
        case "estab":       return dir * (a.estabelecimentoCode ?? "").localeCompare(b.estabelecimentoCode ?? "", "pt-BR");
        case "code":        return dir * a.code.localeCompare(b.code, "pt-BR");
        case "description": return dir * a.description.localeCompare(b.description, "pt-BR");
        case "valorBase":   return dir * ((a.valorBase ?? 0) - (b.valorBase ?? 0));
        case "status":      return dir * (Number(b.isActive) - Number(a.isActive));
        default: return 0;
      }
    });
  }, [search, statusFilter, rows, sortKey, sortDir]);

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
    initialPageSize: 20,
    resetDeps: [search, statusFilter, sortKey, sortDir],
  });
  const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.start, slice.end]);

  const kpis = useMemo(() => ({
    total: rows.length,
    ativas: rows.filter((r) => r.isActive).length,
    comGrade: rows.filter((r) => (r.steps?.length ?? 0) > 0).length,
  }), [rows]);

  // ── Grade: helpers ─────────────────────────────────────────────────────────

  const valorBaseNum = parseDecimal(draft.valorBase);

  /** Calcula valor efetivo para preview (override > calculado). */
  function stepValorEfetivo(s: StepDraft): number | null {
    const override = parseDecimal(s.valorOverride);
    if (override != null) return override;
    const perc = parseDecimal(s.percentual);
    if (valorBaseNum != null && perc != null) {
      return Math.round(valorBaseNum * perc) / 100;
    }
    return null;
  }

  function addStep() {
    setDraft((d) => ({
      ...d,
      steps: [...d.steps, { percentual: "", valorOverride: "", ordem: d.steps.length, observacao: "" }],
    }));
  }

  function removeStep(i: number) {
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, ordem: idx })) }));
  }

  function updateStep(i: number, field: keyof StepDraft, value: string) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s),
    }));
  }

  function applyDefaultGrid() {
    setDraft((d) => ({ ...d, steps: defaultGrid() }));
  }

  // ── Abrir para edição ──────────────────────────────────────────────────────

  async function openEdit(item: Item) {
    // Re-fetch para garantir steps atualizados do backend
    let fullItem: Item = item;
    try {
      fullItem = await fetchJson<Item>(`/api/categorias-salariais/${item.id}`);
    } catch {
      // Fallback: usa o item da lista (pode não ter steps ainda).
    }
    setDraft({
      id: fullItem.id,
      code: fullItem.code,
      description: fullItem.description,
      isActive: fullItem.isActive,
      valorBase: fullItem.valorBase != null ? String(fullItem.valorBase) : "",
      empresaId: fullItem.empresaId ?? null,
      empresaCode: fullItem.empresaCode ?? null,
      empresaDescription: null,
      estabelecimentoId: fullItem.estabelecimentoId ?? null,
      estabelecimentoCode: fullItem.estabelecimentoCode ?? null,
      estabelecimentoName: fullItem.estabelecimentoName ?? null,
      steps: (fullItem.steps ?? []).map((s) => ({
        percentual: String(s.percentual),
        valorOverride: s.valorOverride != null ? String(s.valorOverride) : "",
        ordem: s.ordem,
        observacao: s.observacao ?? "",
      })),
    });
    setEditOpen(true);
  }

  const save = async () => {
    if (!draft.empresaId) { toast.error("Empresa é obrigatória"); return; }
    if (!draft.estabelecimentoId) { toast.error("Estabelecimento é obrigatório"); return; }
    if (!draft.code.trim() || !draft.description.trim()) { toast.error("Código e descrição são obrigatórios"); return; }

    // Valida steps: todos precisam ter Percentual válido
    const invalidStepIdx = draft.steps.findIndex((s) => parseDecimal(s.percentual) == null);
    if (invalidStepIdx >= 0) {
      toast.error(`Percentual do step #${invalidStepIdx + 1} é inválido`);
      return;
    }

    // Valida unicidade de percentuais no payload (backend também valida via unique index)
    const percs = draft.steps.map((s) => parseDecimal(s.percentual));
    const percSet = new Set(percs);
    if (percSet.size !== percs.length) {
      toast.error("Há percentuais duplicados na grade");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        code: draft.code.trim(),
        description: draft.description.trim(),
        isActive: draft.isActive,
        valorBase: parseDecimal(draft.valorBase),
        empresaId: draft.empresaId,
        estabelecimentoId: draft.estabelecimentoId,
        steps: draft.steps.map((s, idx) => ({
          percentual: parseDecimal(s.percentual)!,
          valorOverride: parseDecimal(s.valorOverride),
          ordem: idx, // ordem dos inputs visuais
          observacao: s.observacao.trim() || null,
        })),
      };
      if (draft.id) {
        await fetchJson(`/api/categorias-salariais/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Categoria atualizada");
      } else {
        await fetchJson("/api/categorias-salariais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Categoria criada");
      }
      setEditOpen(false);
      await syncList();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar categoria"); }
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
            estabelecimentoCodigo: key(["estabelecimentocodigo", "estabelecimentocod", "cdn_estab", "estabelecimento"]),
            code: key(["codigo", "code", "cdn_categ_sal"]),
            description: key(["descricao", "description", "des_categ_sal"]),
            valorBase: key(["valorbase", "valor_base", "salariobase"]),
            isActive: statusStr !== "inativo" && statusStr !== "inactive",
          };
        }).filter((r) => r.empresaCodigo && r.estabelecimentoCodigo && r.code && r.description);
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
        isActive: row.isActive,
        valorBase: parseDecimal(row.valorBase),
        empresaCodigo: row.empresaCodigo || null,
        estabelecimentoCodigo: row.estabelecimentoCodigo || null,
      }));
      const result = await fetchJson<{ created: number; updated: number; skipped: number; errors: string[] }>(
        "/api/categorias-salariais/import",
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
    const csv = [["Empresa", "Estabelecimento", "Código", "Descrição", "ValorBase", "Steps", "Status"].join("\t"),
      ...rows.map((x) => [x.empresaCode || "", x.estabelecimentoCode || "", x.code, x.description, x.valorBase ?? "", x.steps?.length ?? 0, x.isActive ? "Ativo" : "Inativo"].join("\t"))
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/plain;charset=utf-8;" }));
    link.download = "categorias-salariais.tsv";
    link.click();
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Categorias Salariais</h4>
          <div className="text-muted-foreground text-sm">Grade percentual por cargo. Defina o Valor Base (100%) e cadastre os degraus (ex.: 80%, 85%, ..., 120%) — o valor de cada degrau é calculado automaticamente ou pode ser inserido manualmente.</div>
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
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Nova categoria</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativas", value: kpis.ativas, color: "text-emerald-600" },
          { label: "Inativas", value: kpis.total - kpis.ativas, color: "text-zinc-500" },
          { label: "Com grade", value: kpis.comGrade, color: "text-blue-600" },
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
            <div className="font-semibold">Lista de categorias</div>
            <div className="text-muted-foreground text-sm">Clique em Editar para alterar o Valor Base e a grade percentual.</div>
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
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("empresa")}>Empresa<SortIcon col="empresa" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("estab")}>Cód. Estab.<SortIcon col="estab" /></TableHead>
              <TableHead>Estabelecimento</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("code")}>Código<SortIcon col="code" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("description")}>Descrição<SortIcon col="description" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("valorBase")}>Valor Base<SortIcon col="valorBase" /></TableHead>
              <TableHead className="text-right">Steps</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm text-muted-foreground font-mono">{item.empresaCode || "—"}</TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">{item.estabelecimentoCode || "—"}</TableCell>
                <TableCell className="text-sm">{item.estabelecimentoName || "—"}</TableCell>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell className="text-sm">{item.description}</TableCell>
                <TableCell className="text-sm text-right font-mono">{formatCurrency(item.valorBase)}</TableCell>
                <TableCell className="text-xs text-right font-mono">{item.steps?.length ?? 0}</TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => openEdit(item)}>
                      <Pencil />
                    </Button>
                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhuma categoria encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar categoria salarial" : "Nova categoria salarial"}</DialogTitle>
            <DialogDescription>Defina o Valor Base (100%) e a grade percentual. Cada degrau pode ter seu valor calculado automaticamente (ValorBase × Percentual/100) ou sobrescrito manualmente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa *</label>
              <EmpresaAutocomplete
                value={draft.empresaId}
                onChange={(id) => setDraft((d) => ({ ...d, empresaId: id, empresaCode: null, empresaDescription: null, estabelecimentoId: null, estabelecimentoCode: null, estabelecimentoName: null }))}
                defaultLabel={draft.empresaCode ? { code: draft.empresaCode, description: draft.empresaDescription ?? "" } : undefined}
                placeholder="Selecione a empresa..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Estabelecimento *</label>
              <EstabelecimentoAutocomplete
                value={draft.estabelecimentoId}
                onChange={(id) => setDraft((d) => ({ ...d, estabelecimentoId: id }))}
                empresaId={draft.empresaId}
                defaultLabel={draft.estabelecimentoCode && draft.estabelecimentoName ? { code: draft.estabelecimentoCode, name: draft.estabelecimentoName } : undefined}
                placeholder="Selecione o estabelecimento..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input placeholder="Ex: A" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={10} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição *</label>
              <Input placeholder="Ex: Analista Pleno" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={120} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor Base (100%)</label>
              <Input
                type="text"
                placeholder="Ex: 8000,00"
                value={draft.valorBase}
                onChange={(e) => setDraft((d) => ({ ...d, valorBase: e.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">Salário de referência. Os degraus da grade aplicam percentuais sobre este valor.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.isActive ? "ativo" : "inativo"} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "ativo" }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          {/* Grade percentual */}
          <div className="pt-4 border-t border-border/40 mt-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold">Grade percentual</div>
                <div className="text-xs text-muted-foreground">Ex.: 80%, 85%, 90%, ..., 120%. Percentuais são livres (pode ter casas decimais, pode passar de 120%).</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={applyDefaultGrid} title="Gerar grade 80% a 120% em passos de 5">
                  <Wand2 className="size-4" /><span className="hidden sm:inline ml-1">Gerar padrão (80-120)</span>
                </Button>
                <Button size="sm" onClick={addStep}>
                  <Plus className="size-4" /><span className="hidden sm:inline ml-1">Adicionar step</span>
                </Button>
              </div>
            </div>

            {draft.steps.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                Nenhum degrau cadastrado. Clique em &quot;Adicionar step&quot; ou em &quot;Gerar padrão (80-120)&quot; para criar a grade.
              </div>
            ) : (
              <div className="rounded-md border border-border/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium w-24">Percentual</th>
                      <th className="px-3 py-2 text-left font-medium w-40">Valor (override)</th>
                      <th className="px-3 py-2 text-left font-medium w-40">Valor efetivo</th>
                      <th className="px-3 py-2 text-left font-medium">Observação</th>
                      <th className="px-3 py-2 text-right font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.steps.map((s, i) => {
                      const efetivo = stepValorEfetivo(s);
                      const override = parseDecimal(s.valorOverride);
                      return (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                className="h-8 w-20 font-mono text-right"
                                placeholder="80"
                                value={s.percentual}
                                onChange={(e) => updateStep(i, "percentual", e.target.value)}
                              />
                              <span className="text-muted-foreground">%</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="text"
                              className="h-8 font-mono"
                              placeholder="(calculado)"
                              value={s.valorOverride}
                              onChange={(e) => updateStep(i, "valorOverride", e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-1.5 font-mono text-sm">
                            <span className={override != null ? "text-blue-600 font-semibold" : "text-muted-foreground"}>
                              {formatCurrency(efetivo)}
                            </span>
                            {override != null && <span className="ml-1 text-xs text-blue-600">(manual)</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="text"
                              className="h-8"
                              placeholder="Opcional"
                              value={s.observacao}
                              onChange={(e) => updateStep(i, "observacao", e.target.value)}
                              maxLength={200}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <Button variant="ghost" size="icon-xs" onClick={() => removeStep(i)} title="Remover step">
                              <X className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
            <DialogTitle>Importar Categorias Salariais</DialogTitle>
            <DialogDescription>
              {importResult ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.` : `${importRows.length} registro(s) encontrado(s). Códigos existentes serão atualizados.`}
            </DialogDescription>
          </DialogHeader>
          <ImportGuide entity="CategoriasSalariais" columns={[
            { name: "EmpresaCodigo", hint: "Ex: 1 (cdn_empresa)", required: true },
            { name: "EstabelecimentoCodigo", hint: "Ex: 1 (cdn_estab)", required: true },
            { name: "Codigo", hint: "Ex: A (cdn_categ_sal)", required: true },
            { name: "Descricao", hint: "Ex: Analista Pleno (des_categ_sal)", required: true },
            { name: "ValorBase", hint: "Ex: 8000,00 (opcional)" },
            { name: "Status", hint: "Ativo / Inativo" },
          ]} />
          <p className="text-xs text-muted-foreground">Dica: os degraus da grade (steps) não são importados por XLSX — edite em tela após importar.</p>
          {!importResult && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2 text-left font-medium">Estabelecimento</th>
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium">Valor Base</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.empresaCodigo}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.estabelecimentoCodigo}</td>
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.valorBase || "—"}</td>
                      <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>{r.isActive ? "Ativo" : "Inativo"}</span></td>
                    </tr>
                  ))}
                  {importRows.length > 50 && <tr className="border-t"><td colSpan={6} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {importRows.length - 50} registro(s)</td></tr>}
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
            <DialogDescription>Excluir a categoria <strong>&quot;{deleteTarget?.description}&quot;</strong>? Todos os degraus da grade serão removidos junto. Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { if (!deleteTarget) return; try { await fetchJson(`/api/categorias-salariais/${deleteTarget.id}`, { method: "DELETE" }); toast.success("Categoria removida"); setDeleteTarget(null); await syncList(); } catch { toast.error("Erro ao remover"); } }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
