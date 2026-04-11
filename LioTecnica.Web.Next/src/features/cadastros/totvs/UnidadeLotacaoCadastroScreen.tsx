"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Download, Upload, ChevronRight, ChevronDown, Users2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportGuide } from "@/components/ImportGuide";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

/* ── types ── */

interface Item {
  id: string;
  cdnPlanoLotac: string;
  code: string;
  description: string;
  location?: string;
  notes?: string;
  isActive: boolean;
  // Hierarquia
  parentId?: string;
  parentCode?: string;
  parentDescription?: string;
  level: number;
  calculatedLevel: number;
  sequenceNumber?: number;
  // Responsável
  ownerFuncionarioId?: string;
  ownerFuncionarioName?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface Draft {
  id?: string;
  code: string;
  description: string;
  location: string;
  notes: string;
  isActive: boolean;
  // Hierarquia
  parentId: string | null;
  level: number;
  sequenceNumber: string;
  // Responsável
  ownerFuncionarioId: string | null;
}

interface ImportRow {
  cdnPlanoLotac: string;
  code: string;
  description: string;
  location: string;
  parentCode: string;
  level: number;
  isActive: boolean;
}

interface OwnerImportRow {
  cdnPlanoLotac: string;
  unitCode: string;
  cdnEmpresa: string;
  cdnEstab: string;
  cdnFuncionario: string;
}

interface LookupItem {
  id: string;
  name: string;
}

/* ── tree ── */

interface ItemNode extends Item {
  children: ItemNode[];
}

function buildTree(items: Item[]): ItemNode[] {
  const byId = new Map<string, ItemNode>();
  for (const item of items) byId.set(item.id, { ...item, children: [] });
  const roots: ItemNode[] = [];
  for (const node of byId.values()) {
    if (!node.parentId || !byId.has(node.parentId)) roots.push(node);
    else byId.get(node.parentId)!.children.push(node);
  }
  const sortNodes = (nodes: ItemNode[]) => {
    nodes.sort((a, b) =>
      a.cdnPlanoLotac.localeCompare(b.cdnPlanoLotac) ||
      (a.sequenceNumber ?? 9999) - (b.sequenceNumber ?? 9999) ||
      a.code.localeCompare(b.code)
    );
    nodes.forEach((n) => { if (n.children.length) sortNodes(n.children); });
  };
  sortNodes(roots);
  return roots;
}

function walkTreeVisible(roots: ItemNode[], collapsedKeys: Set<string>) {
  const rows: Array<{ item: ItemNode; depth: number; hasChildren: boolean; isCollapsed: boolean }> = [];
  function walk(nodes: ItemNode[], depth: number) {
    for (const n of nodes) {
      const hasChildren = n.children.length > 0;
      const isCollapsed = hasChildren && collapsedKeys.has(n.id);
      rows.push({ item: n, depth, hasChildren, isCollapsed });
      if (hasChildren && !isCollapsed) walk(n.children, depth + 1);
    }
  }
  walk(roots, 0);
  return rows;
}

/* ── helpers ── */

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
  code: "", description: "", location: "", notes: "", isActive: true,
  parentId: null, level: 1, sequenceNumber: "", ownerFuncionarioId: null,
};

/* ── component ── */

export default function UnidadeLotacaoCadastroScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortCol, setSortCol] = useState<string>("cdnPlanoLotac");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  // Start fully collapsed; populated after rows load
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedKeys(new Set(rows.map((r) => r.id)));
  }, [rows]);

  const expandAll = useCallback(() => {
    setCollapsedKeys(new Set());
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number; errorMessages: string[]; warnings: string[] } | null>(null);

  const ownerFileInputRef = useRef<HTMLInputElement>(null);
  const [ownerImportRows, setOwnerImportRows] = useState<OwnerImportRow[]>([]);
  const [ownerImportOpen, setOwnerImportOpen] = useState(false);
  const [ownerImporting, setOwnerImporting] = useState(false);
  const [ownerImportResult, setOwnerImportResult] = useState<{ updated: number; unidadeNaoEncontrada: number; funcionarioNaoEncontrado: number; errors: string[] } | null>(null);

  const syncList = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchJson<Item[]>("/api/unidades-lotacao/tree");
      const list = Array.isArray(items) ? items : [];
      setRows(list);
      // Start fully collapsed — only nodes that have children matter, but collapsing all is safe
      setCollapsedKeys(new Set(list.map((r) => r.id)));
    } catch {
      toast.error("Erro ao carregar unidades de lotação");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFuncionarios = useCallback(async () => {
    try {
      const res = await fetchJson<LookupItem[]>("/api/lookup/funcionarios");
      setFuncionarios(Array.isArray(res) ? res : []);
    } catch { /* lookup opcional */ }
  }, []);

  useEffect(() => { syncList(); loadFuncionarios(); }, [syncList, loadFuncionarios]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((x) => {
      if (statusFilter === "ativo" && !x.isActive) return false;
      if (statusFilter === "inativo" && x.isActive) return false;
      if (!q) return true;
      return (
        x.code.toLowerCase().includes(q) ||
        x.description.toLowerCase().includes(q) ||
        (x.ownerFuncionarioName?.toLowerCase().includes(q) ?? false)
      );
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "cdnPlanoLotac") cmp = a.cdnPlanoLotac.localeCompare(b.cdnPlanoLotac) || a.code.localeCompare(b.code);
      else if (sortCol === "code") cmp = a.code.localeCompare(b.code);
      else if (sortCol === "description") cmp = a.description.localeCompare(b.description);
      else if (sortCol === "location") cmp = (a.location ?? "").localeCompare(b.location ?? "");
      else if (sortCol === "ownerFuncionarioName") cmp = (a.ownerFuncionarioName ?? "").localeCompare(b.ownerFuncionarioName ?? "");
      else if (sortCol === "isActive") cmp = Number(b.isActive) - Number(a.isActive);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [search, statusFilter, rows, sortCol, sortDir]);

  const isFiltering = search.trim() !== "" || statusFilter !== "all";

  // Calcula todos os nós visíveis da árvore ANTES da paginação
  const allTreeRows = useMemo(() => {
    if (isFiltering) return null;
    return walkTreeVisible(buildTree(rows), collapsedKeys);
  }, [rows, collapsedKeys, isFiltering]);

  const totalForPagination = allTreeRows ? allTreeRows.length : filtered.length;

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(totalForPagination, {
    initialPageSize: 50,
    resetDeps: [search, statusFilter, collapsedKeys, sortCol, sortDir],
  });

  // Aplica paginação tanto na árvore quanto na lista plana
  const treeRows = useMemo(
    () => allTreeRows ? allTreeRows.slice(slice.start, slice.end) : null,
    [allTreeRows, slice.start, slice.end],
  );
  const paged = useMemo(
    () => allTreeRows ? [] : filtered.slice(slice.start, slice.end),
    [allTreeRows, filtered, slice.start, slice.end],
  );

  const kpis = useMemo(() => ({
    total: rows.length,
    ativas: rows.filter((r) => r.isActive).length,
  }), [rows]);

  // Unidades disponíveis para seleção de pai (excluindo o item sendo editado)
  const parentOptions = useMemo(
    () => rows.filter((r) => r.id !== draft.id),
    [rows, draft.id]
  );

  const save = async () => {
    if (!draft.code.trim() || !draft.description.trim()) {
      toast.error("Código e descrição são obrigatórios");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        code: draft.code.trim(),
        description: draft.description.trim(),
        location: draft.location?.trim() || null,
        notes: draft.notes?.trim() || null,
        isActive: draft.isActive,
        parentId: draft.parentId || null,
        level: draft.level || 1,
        sequenceNumber: draft.sequenceNumber ? parseInt(draft.sequenceNumber, 10) : null,
        ownerFuncionarioId: draft.ownerFuncionarioId || null,
      };
      if (draft.id) {
        await fetchJson(`/api/unidades-lotacao/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Unidade de Lotação atualizada");
      } else {
        await fetchJson("/api/unidades-lotacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Unidade de Lotação criada");
      }
      setEditOpen(false);
      await syncList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("cíclica") || msg.includes("ciclica")) toast.error("Hierarquia cíclica detectada");
      else if (msg.includes("pai")) toast.error("Unidade pai não encontrada");
      else toast.error("Erro ao salvar unidade de lotação");
    } finally {
      setSaving(false);
    }
  };

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
          const key = (variants: string[]) => { const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v))); return f ? String(r[f] ?? "").trim() : ""; };
          const statusStr = key(["status", "ativo", "ativa"]).toLowerCase();
          const lvl = parseInt(key(["nivel", "level", "niv"]), 10);
          return {
            cdnPlanoLotac: key(["cdnplanolotac", "cdn_plano_lotac", "plano", "plan"]),
            code: key(["codigo", "code"]),
            description: key(["descricao", "description"]),
            location: key(["localizacao", "location", "local"]),
            parentCode: key(["pai", "parent", "cod_pai", "unidade_pai"]),
            level: isNaN(lvl) ? 1 : lvl,
            isActive: statusStr !== "inativo" && statusStr !== "inactive",
          };
        }).filter((r) => r.code && r.description);
        if (parsed.length === 0) { toast.error("Nenhuma linha válida encontrada."); return; }
        const semPlano = parsed.filter((r) => !r.cdnPlanoLotac).length;
        if (semPlano > 0) toast.warning(`${semPlano} linha(s) sem CdnPlanoLotac — verifique o arquivo.`);
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
        cdnPlanoLotac: row.cdnPlanoLotac,
        code: row.code,
        description: row.description,
        location: row.location || null,
        notes: null,
        isActive: row.isActive,
        parentCodigo: row.parentCode || null,
        level: row.level,
        sequenceNumber: null,
      }));
      const result = await fetchJson<{ created: number; updated: number; skipped: number; errors: string[]; warnings: string[] }>(
        "/api/unidades-lotacao/import",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      setImportResult({ created: result.created, updated: result.updated, errors: result.skipped + result.errors.length, errorMessages: result.errors, warnings: result.warnings ?? [] });
      await syncList();
    } catch (e) {
      toast.error(`Falha na importação: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setImporting(false);
    }
  };

  const handleOwnerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s-]/g, "").trim();
        const parsed: OwnerImportRow[] = raw.map((r) => {
          const key = (variants: string[]) => { const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v))); return f ? String(r[f] ?? "").trim() : ""; };
          return {
            cdnPlanoLotac: key(["cdnplanolotac", "cdn_plano_lotac", "plano", "plan"]),
            unitCode: key(["cod_unid_lotac", "codunidlotac", "unitcode", "unit_code", "codigo", "code"]),
            cdnEmpresa: key(["cdn_empresa_resp", "cdnempresaresp", "cdn_empresa", "cdnempresa", "empresa"]),
            cdnEstab: key(["cdn_estab_resp", "cdnestabresp", "cdn_estab", "cdnestab", "estab"]),
            cdnFuncionario: key(["cdn_funcionario_responsavel", "cdnfuncionarioresp", "cdn_funcionario", "cdnfuncionario", "matricula"]),
          };
        }).filter((r) => r.unitCode && r.cdnFuncionario);
        if (parsed.length === 0) { toast.error("Nenhuma linha válida. Verifique as colunas: cod_unid_lotac, cdn_empresa_resp, cdn_estab_resp, cdn_funcionario_responsavel."); return; }
        setOwnerImportRows(parsed); setOwnerImportResult(null); setOwnerImportOpen(true);
      } catch { toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const runOwnerImport = async () => {
    if (ownerImportRows.length === 0) return;
    setOwnerImporting(true);
    try {
      const payload = ownerImportRows.map((row) => ({
        cdnPlanoLotac: row.cdnPlanoLotac,
        unitCode: row.unitCode,
        cdnEmpresa: row.cdnEmpresa || null,
        cdnEstab: row.cdnEstab || null,
        cdnFuncionario: row.cdnFuncionario,
      }));
      const result = await fetchJson<{ updated: number; unidadeNaoEncontrada: number; funcionarioNaoEncontrado: number; errors: string[] }>(
        "/api/unidades-lotacao/import-owners",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      setOwnerImportResult(result);
      await syncList();
    } catch (e) {
      toast.error(`Falha na importação: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setOwnerImporting(false);
    }
  };

  const exportTsv = () => {
    const csv = [
      ["Código", "Descrição", "Pai", "Nível", "Sequência", "Localização", "Responsável", "Nível Calculado", "Status"].join("\t"),
      ...rows.map((x) => [
        x.code, x.description, x.parentCode || "", x.level, x.sequenceNumber ?? "",
        x.location || "", x.ownerFuncionarioName || "", x.calculatedLevel,
        x.isActive ? "Ativo" : "Inativo",
      ].join("\t"))
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/plain;charset=utf-8;" }));
    link.download = "unidades-lotacao.tsv";
    link.click();
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Unidades de Lotação</h4>
          <div className="text-muted-foreground text-sm">Cadastro hierárquico de unidades organizacionais.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportTsv} title="Exportar">
            <Download className="size-4" /><span className="hidden sm:inline ml-1">Exportar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title="Importar unidades">
            <Upload className="size-4" /><span className="hidden sm:inline ml-1">Importar</span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={() => ownerFileInputRef.current?.click()} title="Importar responsáveis">
            <Users2 className="size-4" /><span className="hidden sm:inline ml-1">Responsáveis</span>
          </Button>
          <input ref={ownerFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleOwnerFileSelect} />
          <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}>
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Nova unidade</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativas", value: kpis.ativas, color: "text-emerald-600" },
          { label: "Inativas", value: kpis.total - kpis.ativas, color: "text-zinc-500" },
          { label: "Exibindo", value: allTreeRows ? allTreeRows.length : filtered.length, color: "text-primary" },
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
            <div className="font-semibold">Lista de unidades de lotação</div>
            <div className="text-muted-foreground text-sm">Clique em Editar para alterar um registro.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {treeRows !== null && (
              <>
                <Button variant="outline" size="sm" onClick={expandAll} title="Expandir tudo">
                  <ChevronDown className="size-4" /><span className="hidden sm:inline ml-1">Expandir tudo</span>
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} title="Recolher tudo">
                  <ChevronRight className="size-4" /><span className="hidden sm:inline ml-1">Recolher tudo</span>
                </Button>
              </>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-[220px] pl-8" placeholder="código, descrição, responsável..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
              {(["cdnPlanoLotac", "code", "description", null, "location", "ownerFuncionarioName", "isActive"] as const).map((col, i) => {
                const labels = ["Plano", "Código", "Descrição", "Hierarquia", "Localização", "Responsável", "Status"];
                if (!col) return <TableHead key={i}>{labels[i]}</TableHead>;
                const icon = sortCol !== col ? <ArrowUpDown className="size-3 opacity-40" /> : sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
                return (
                  <TableHead key={col} className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
                    <div className="flex items-center gap-1">{labels[i]}{icon}</div>
                  </TableHead>
                );
              })}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : treeRows !== null ? (
              treeRows.length === 0
                ? <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma unidade de lotação encontrada.</TableCell></TableRow>
                : treeRows.map(({ item, depth, hasChildren, isCollapsed }) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.cdnPlanoLotac}</TableCell>
                    <TableCell>
                      <div className="flex items-center" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className={cn("mr-1 size-5 shrink-0", !hasChildren && "invisible pointer-events-none")}
                          onClick={() => toggleCollapse(item.id)}
                        >
                          {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                        </Button>
                        <span className="font-mono text-sm">{item.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{item.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Nível {item.level}</TableCell>
                    <TableCell className="text-muted-foreground">{item.location || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.ownerFuncionarioName || "—"}</TableCell>
                    <TableCell>{statusBadge(item.isActive)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="icon-xs" title="Editar" onClick={() => {
                          setDraft({
                            id: item.id, code: item.code, description: item.description,
                            location: item.location || "", notes: item.notes || "", isActive: item.isActive,
                            parentId: item.parentId ?? null, level: item.level,
                            sequenceNumber: item.sequenceNumber?.toString() ?? "",
                            ownerFuncionarioId: item.ownerFuncionarioId ?? null,
                          });
                          setEditOpen(true);
                        }}><Pencil /></Button>
                        <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}><Trash2 /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.cdnPlanoLotac}</TableCell>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell className="font-semibold">{item.description}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  Nível {item.level}
                  {item.parentCode && <div className="font-mono mt-0.5">↳ {item.parentCode}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.location || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.ownerFuncionarioName || "—"}</TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => {
                      setDraft({
                        id: item.id, code: item.code, description: item.description,
                        location: item.location || "", notes: item.notes || "", isActive: item.isActive,
                        parentId: item.parentId ?? null, level: item.level,
                        sequenceNumber: item.sequenceNumber?.toString() ?? "",
                        ownerFuncionarioId: item.ownerFuncionarioId ?? null,
                      });
                      setEditOpen(true);
                    }}><Pencil /></Button>
                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}><Trash2 /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma unidade de lotação encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={totalForPagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar unidade de lotação" : "Nova unidade de lotação"}</DialogTitle>
            <DialogDescription>Preencha os dados da unidade organizacional.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Código */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input placeholder="Ex: UL001" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={30} />
            </div>
            {/* Descrição */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição *</label>
              <Input placeholder="Ex: Matriz" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={120} />
            </div>
            {/* Unidade Pai */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Unidade Pai</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.parentId ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value || null }))}
              >
                <option value="">— Nenhuma (raiz) —</option>
                {parentOptions
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} — {u.description}
                    </option>
                  ))}
              </select>
            </div>
            {/* Responsável */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Responsável (dono)</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.ownerFuncionarioId ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, ownerFuncionarioId: e.target.value || null }))}
              >
                <option value="">Nenhum</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {/* Nível TOTVS */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nível (TOTVS)</label>
              <Input
                type="number"
                min={1}
                placeholder="1"
                value={draft.level}
                onChange={(e) => setDraft((d) => ({ ...d, level: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            {/* Sequência */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sequência</label>
              <Input
                type="number"
                min={1}
                placeholder="Ordem dentro do nível"
                value={draft.sequenceNumber}
                onChange={(e) => setDraft((d) => ({ ...d, sequenceNumber: e.target.value }))}
              />
            </div>
            {/* Localização */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Localização</label>
              <Input placeholder="Ex: Prédio A, 2º Andar" value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} maxLength={120} />
            </div>
            {/* Status */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.isActive ? "ativo" : "inativo"} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "ativo" }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
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
            <DialogTitle>Importar Unidades de Lotação</DialogTitle>
            <DialogDescription>
              {importResult
                ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.`
                : `${importRows.length} registro(s) encontrado(s). Códigos existentes serão atualizados.`}
            </DialogDescription>
          </DialogHeader>
          {importResult && importResult.errorMessages.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
              {importResult.errorMessages.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
          {importResult && importResult.warnings.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-yellow-400/40 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 space-y-1">
              <div className="font-semibold mb-1">Avisos ({importResult.warnings.length})</div>
              {importResult.warnings.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
          <ImportGuide entity="UnidadesLotacao" columns={[
            { name: "CdnPlanoLotac", hint: "Código do plano de lotação TOTVS (ex: 101)", required: true },
            { name: "Codigo", hint: "Ex: 00001183", required: true },
            { name: "Descricao", hint: "Ex: Sede Rio de Janeiro", required: true },
            { name: "Pai", hint: "Código da unidade pai (opcional)" },
            { name: "Nivel", hint: "Nível hierárquico do TOTVS (ex: 1, 2, 3)" },
            { name: "Localizacao", hint: "Ex: Bloco A, 3º andar" },
            { name: "Status", hint: "Ativo / Inativo" },
          ]} />
          {!importResult && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Plano</th>
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium">Pai</th>
                    <th className="px-3 py-2 text-left font-medium">Nível</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.cdnPlanoLotac || "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono">{r.parentCode || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.level}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>
                          {r.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {importRows.length > 50 && (
                    <tr className="border-t"><td colSpan={6} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {importRows.length - 50} registro(s)</td></tr>
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
              <Button onClick={runImport} disabled={importing}>
                {importing ? "Importando…" : `Importar ${importRows.length} registro(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Import Dialog */}
      <Dialog open={ownerImportOpen} onOpenChange={(open) => { if (!ownerImporting) { setOwnerImportOpen(open); if (!open) { setOwnerImportRows([]); setOwnerImportResult(null); } } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Responsáveis das Unidades</DialogTitle>
            <DialogDescription>
              {ownerImportResult
                ? `Concluído: ${ownerImportResult.updated} vinculado(s)${ownerImportResult.unidadeNaoEncontrada > 0 ? `, ${ownerImportResult.unidadeNaoEncontrada} unidade(s) não encontrada(s)` : ""}${ownerImportResult.funcionarioNaoEncontrado > 0 ? `, ${ownerImportResult.funcionarioNaoEncontrado} funcionário(s) não encontrado(s)` : ""}.`
                : `${ownerImportRows.length} registro(s) encontrado(s). O responsável será vinculado pela matrícula TOTVS.`}
            </DialogDescription>
          </DialogHeader>
          <ImportGuide entity="ResponsaveisUnidade" columns={[
            { name: "CdnPlanoLotac", hint: "Código do plano de lotação TOTVS (ex: 101)", required: true },
            { name: "cod_unid_lotac", hint: "Código da unidade de lotação", required: true },
            { name: "cdn_empresa_resp", hint: "Código da empresa no TOTVS" },
            { name: "cdn_estab_resp", hint: "Código do estabelecimento no TOTVS" },
            { name: "cdn_funcionario_responsavel", hint: "Matrícula do funcionário responsável", required: true },
          ]} />
          {!ownerImportResult && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Plano</th>
                    <th className="px-3 py-2 text-left font-medium">Cód. Unidade</th>
                    <th className="px-3 py-2 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2 text-left font-medium">Estab</th>
                    <th className="px-3 py-2 text-left font-medium">Matrícula</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerImportRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.cdnPlanoLotac || "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{r.unitCode}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.cdnEmpresa || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.cdnEstab || "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{r.cdnFuncionario}</td>
                    </tr>
                  ))}
                  {ownerImportRows.length > 50 && (
                    <tr className="border-t"><td colSpan={5} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {ownerImportRows.length - 50} registro(s)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {ownerImportResult?.errors && ownerImportResult.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive mb-1">Erros ({ownerImportResult.errors.length}):</p>
              {ownerImportResult.errors.slice(0, 20).map((err, i) => (
                <p key={i} className="text-xs text-destructive">{err}</p>
              ))}
              {ownerImportResult.errors.length > 20 && <p className="text-xs text-muted-foreground">… e mais {ownerImportResult.errors.length - 20} erro(s)</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOwnerImportOpen(false); setOwnerImportRows([]); setOwnerImportResult(null); }} disabled={ownerImporting}>
              {ownerImportResult ? "Fechar" : "Cancelar"}
            </Button>
            {!ownerImportResult && (
              <Button onClick={runOwnerImport} disabled={ownerImporting}>
                {ownerImporting ? "Importando…" : `Importar ${ownerImportRows.length} registro(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Excluir a unidade <strong>"{deleteTarget?.description}"</strong>?
              Unidades com filhos não podem ser excluídas. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!deleteTarget) return;
              try {
                await fetchJson(`/api/unidades-lotacao/${deleteTarget.id}`, { method: "DELETE" });
                toast.success("Unidade removida");
                setDeleteTarget(null);
                await syncList();
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "";
                if (msg.includes("filhas") || msg.includes("filhos")) toast.error("Não é possível excluir: existem unidades filhas");
                else toast.error("Erro ao remover");
              }
            }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
