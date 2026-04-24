"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Download, Upload, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";

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

interface Item {
  id: string;
  code: string;
  description: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  unidadeLotacaoId?: string | null;
  unidadeLotacaoNome?: string | null;
}

interface Draft {
  id?: string;
  code: string;
  description: string;
  startTime: string;
  endTime: string;
  notes: string;
  isActive: boolean;
  unidadeLotacaoId: string;
}

interface ImportRow {
  code: string;
  description: string;
  startTime: string;
  endTime: string;
  notes: string;
  isActive: boolean;
  unidadeLotacaoId: string;
}

interface UnidadeLotacaoOption {
  id: string;
  code: string;
  description: string;
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

const emptyDraft: Draft = { code: "", description: "", startTime: "", endTime: "", notes: "", isActive: true, unidadeLotacaoId: "" };

export default function TurnoCadastroScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [unidades, setUnidades] = useState<UnidadeLotacaoOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("all");
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
      const [items, unidadesRes] = await Promise.all([
        fetchJson<Item[]>("/api/turnos?take=5000"),
        fetchJson<Array<{ id: string; code: string; description: string }>>("/api/unidades-lotacao?take=5000").catch(() => []),
      ]);
      setRows(Array.isArray(items) ? items : []);
      setUnidades(Array.isArray(unidadesRes) ? unidadesRes.map((u) => ({ id: u.id, code: u.code, description: u.description })) : []);
    } catch {
      toast.error("Erro ao carregar turnos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncList(); }, [syncList]);

  type SortKey = "code" | "description" | "status";
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
      if (unidadeFilter === "global" && x.unidadeLotacaoId) return false;
      if (unidadeFilter !== "all" && unidadeFilter !== "global" && x.unidadeLotacaoId !== unidadeFilter) return false;
      if (!q) return true;
      return x.code.toLowerCase().includes(q) || x.description.toLowerCase().includes(q);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      switch (sortKey) {
        case "code":        return dir * a.code.localeCompare(b.code, "pt-BR");
        case "description": return dir * a.description.localeCompare(b.description, "pt-BR");
        case "status":      return dir * (Number(b.isActive) - Number(a.isActive));
        default: return 0;
      }
    });
  }, [search, statusFilter, unidadeFilter, rows, sortKey, sortDir]);

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
    initialPageSize: 20,
    resetDeps: [search, statusFilter, unidadeFilter, sortKey, sortDir],
  });
  const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.start, slice.end]);

  const kpis = useMemo(() => ({
    total: rows.length,
    ativos: rows.filter((r) => r.isActive).length,
  }), [rows]);

  const save = async () => {
    if (!draft.code.trim() || !draft.description.trim()) { toast.error("Código e descrição são obrigatórios"); return; }
    try {
      setSaving(true);
      const payload = {
        code: draft.code.trim(),
        description: draft.description.trim(),
        startTime: draft.startTime?.trim() || null,
        endTime: draft.endTime?.trim() || null,
        notes: draft.notes?.trim() || null,
        isActive: draft.isActive,
        unidadeLotacaoId: draft.unidadeLotacaoId || null,
      };
      if (draft.id) {
        await fetchJson(`/api/turnos/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Turno atualizado");
      } else {
        await fetchJson("/api/turnos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Turno criado");
      }
      setEditOpen(false);
      await syncList();
    } catch { toast.error("Erro ao salvar turno"); }
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
        // Preserve leading zeros and convert date cells to ISO strings
        if (sheet["!ref"]) { const range = XLSX.utils.decode_range(sheet["!ref"]); for (let R = range.s.r; R <= range.e.r; R++) { for (let C = range.s.c; C <= range.e.c; C++) { const ref = XLSX.utils.encode_cell({ r: R, c: C }); const cell = sheet[ref]; if (cell && cell.t === "d" && cell.v instanceof Date) { const d = cell.v as Date; cell.t = "s"; cell.v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; } else if (cell && cell.t === "n") { cell.t = "s"; cell.v = cell.w ?? String(cell.v); } } } }
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (raw.length === 0) { toast.error("Planilha vazia."); return; }
        const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const parsed: ImportRow[] = raw.map((r) => {
          const key = (variants: string[]) => { const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v))); return f ? String(r[f] ?? "").trim() : ""; };
          const statusStr = key(["status", "ativo", "ativa"]).toLowerCase();
          const unidadeKey = key(["unidade", "unidadelotacao", "unidade lotacao", "codigo unidade", "unidade_codigo"]);
          const unidadeMatch = unidadeKey
            ? unidades.find((u) => u.code.toLowerCase() === unidadeKey.toLowerCase() || u.description.toLowerCase() === unidadeKey.toLowerCase())
            : null;
          return {
            code: key(["codigo", "code"]),
            description: key(["descricao", "description"]),
            startTime: key(["inicio", "start", "starttime", "hora inicio"]),
            endTime: key(["fim", "end", "endtime", "hora fim"]),
            notes: key(["observacoes", "observacao", "notes", "obs"]),
            isActive: statusStr !== "inativo" && statusStr !== "inactive",
            unidadeLotacaoId: unidadeMatch?.id ?? "",
          };
        }).filter((r) => r.code && r.description);
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
        startTime: row.startTime || null,
        endTime: row.endTime || null,
        notes: row.notes || null,
        isActive: row.isActive,
        unidadeLotacaoId: row.unidadeLotacaoId || null,
      }));
      const result = await fetchJson<{ created: number; updated: number; skipped: number; errors: string[] }>(
        "/api/turnos/import",
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
    const csv = [["Código", "Descrição", "Início", "Fim", "Observações", "Status", "Unidade"].join("\t"),
      ...rows.map((x) => [x.code, x.description, x.startTime || "", x.endTime || "", x.notes || "", x.isActive ? "Ativo" : "Inativo", x.unidadeLotacaoNome || ""].join("\t"))
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/plain;charset=utf-8;" }));
    link.download = "turnos.tsv";
    link.click();
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Turnos</h4>
          <div className="text-muted-foreground text-sm">Cadastro de turnos de trabalho.</div>
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
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo turno</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativos", value: kpis.ativos, color: "text-emerald-600" },
          { label: "Inativos", value: kpis.total - kpis.ativos, color: "text-zinc-500" },
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
            <div className="font-semibold">Lista de turnos</div>
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
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={unidadeFilter} onChange={(e) => { setUnidadeFilter(e.target.value); setPage(1); }}>
              <option value="all">Todas as unidades</option>
              <option value="global">Global (sem unidade)</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.code} — {u.description}</option>
              ))}
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("code")}>Código<SortIcon col="code" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("description")}>Descrição<SortIcon col="description" /></TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm text-muted-foreground">{item.code}</TableCell>
                <TableCell className="font-semibold">{item.description}</TableCell>
                <TableCell className="text-sm">
                  {item.unidadeLotacaoNome ? item.unidadeLotacaoNome : <span className="italic text-muted-foreground">Global</span>}
                </TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => { setDraft({ id: item.id, code: item.code, description: item.description, startTime: item.startTime || "", endTime: item.endTime || "", notes: item.notes || "", isActive: item.isActive, unidadeLotacaoId: item.unidadeLotacaoId || "" }); setEditOpen(true); }}>
                      <Pencil />
                    </Button>
                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum turno encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar turno" : "Novo turno"}</DialogTitle>
            <DialogDescription>Preencha os dados do turno de trabalho.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input placeholder="Ex: T1" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={30} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição *</label>
              <Input placeholder="Ex: Manhã" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={120} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Início (HH:mm)</label>
              <Input placeholder="08:00" value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} maxLength={5} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Fim (HH:mm)</label>
              <Input placeholder="17:00" value={draft.endTime} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} maxLength={5} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="..." value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} maxLength={500} rows={3} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.isActive ? "ativo" : "inativo"} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "ativo" }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Unidade de lotação</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.unidadeLotacaoId} onChange={(e) => setDraft((d) => ({ ...d, unidadeLotacaoId: e.target.value }))}>
                <option value="">Global (todas as unidades)</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>{u.code} — {u.description}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Quando preenchido, o turno só é válido para a unidade escolhida.</p>
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
            <DialogTitle>Importar Turnos</DialogTitle>
            <DialogDescription>
              {importResult ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.` : `${importRows.length} registro(s) encontrado(s). Códigos existentes serão atualizados.`}
            </DialogDescription>
          </DialogHeader>
          <ImportGuide entity="Turnos" columns={[
            { name: "Codigo", hint: "Ex: T1", required: true },
            { name: "Descricao", hint: "Ex: Manhã", required: true },
            { name: "Inicio", hint: "Ex: 08:00" },
            { name: "Fim", hint: "Ex: 17:00" },
            { name: "Observacoes", hint: "Texto livre" },
            { name: "Status", hint: "Ativo / Inativo" },
            { name: "Unidade", hint: "Código ou descrição (vazio = global)" },
          ]} />
          {!importResult && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium">Início</th>
                    <th className="px-3 py-2 text-left font-medium">Fim</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.startTime || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.endTime || "—"}</td>
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
            <DialogDescription>Excluir o turno <strong>"{deleteTarget?.description}"</strong>? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { if (!deleteTarget) return; try { await fetchJson(`/api/turnos/${deleteTarget.id}`, { method: "DELETE" }); toast.success("Turno removido"); setDeleteTarget(null); await syncList(); } catch { toast.error("Erro ao remover"); } }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
