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
  cdnNivCargo: number;
  nomReduz: string;
  nomComplet: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface Draft {
  id?: string;
  cdnNivCargo: string;
  nomReduz: string;
  nomComplet: string;
  isActive: boolean;
}

interface ImportRow {
  cdnNivCargo: number;
  nomReduz: string;
  nomComplet: string;
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

const emptyDraft: Draft = { cdnNivCargo: "", nomReduz: "", nomComplet: "", isActive: true };

export default function NivelCargoCadastroScreen() {
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
      const items = await fetchJson<Item[]>("/api/nivel-cargo?take=5000");
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Erro ao carregar níveis de cargo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncList(); }, [syncList]);

  type SortKey = "codigo" | "reduzido" | "completo" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("codigo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="inline size-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ChevronUp className="inline size-3 ml-1" />
      : <ChevronDown className="inline size-3 ml-1" />;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = rows.filter((x) => {
      if (statusFilter === "ativo" && !x.isActive) return false;
      if (statusFilter === "inativo" && x.isActive) return false;
      if (!q) return true;
      return (
        String(x.cdnNivCargo).includes(q) ||
        x.nomReduz.toLowerCase().includes(q) ||
        x.nomComplet.toLowerCase().includes(q)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      switch (sortKey) {
        case "codigo":   return dir * (a.cdnNivCargo - b.cdnNivCargo);
        case "reduzido": return dir * a.nomReduz.localeCompare(b.nomReduz, "pt-BR");
        case "completo": return dir * a.nomComplet.localeCompare(b.nomComplet, "pt-BR");
        case "status":   return dir * (Number(b.isActive) - Number(a.isActive));
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
    ativos: rows.filter((r) => r.isActive).length,
  }), [rows]);

  const save = async () => {
    const cdn = parseInt(draft.cdnNivCargo, 10);
    if (isNaN(cdn) || cdn <= 0) { toast.error("Código numérico (cdn_niv_cargo) é obrigatório"); return; }
    if (!draft.nomReduz.trim()) { toast.error("Nome reduzido é obrigatório"); return; }
    if (!draft.nomComplet.trim()) { toast.error("Nome completo é obrigatório"); return; }
    try {
      setSaving(true);
      const payload = {
        cdnNivCargo: cdn,
        nomReduz: draft.nomReduz.trim().slice(0, 6),
        nomComplet: draft.nomComplet.trim().slice(0, 40),
        isActive: draft.isActive,
      };
      if (draft.id) {
        await fetchJson(`/api/nivel-cargo/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Nível de cargo atualizado");
      } else {
        await fetchJson("/api/nivel-cargo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Nível de cargo criado");
      }
      setEditOpen(false);
      await syncList();
    } catch { toast.error("Erro ao salvar nível de cargo"); }
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
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (raw.length === 0) { toast.error("Planilha vazia."); return; }
        const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const parsed: ImportRow[] = raw.map((r) => {
          const key = (variants: string[]) => { const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v))); return f ? String(r[f] ?? "").trim() : ""; };
          const statusStr = key(["status", "ativo"]).toLowerCase();
          const cdn = parseInt(key(["cdn_niv_cargo", "codigo", "code", "cdn"]), 10);
          return {
            cdnNivCargo: isNaN(cdn) ? 0 : cdn,
            nomReduz: key(["nom_reduz_niv_cargo", "nome reduzido", "reduzido", "nomreduz"]).slice(0, 6),
            nomComplet: key(["nom_complet_niv_cargo", "nome completo", "completo", "nomcomplet", "descricao", "description"]).slice(0, 40),
            isActive: statusStr !== "inativo" && statusStr !== "inactive",
          };
        }).filter((r) => r.cdnNivCargo > 0 && r.nomComplet);
        if (parsed.length === 0) { toast.error("Nenhuma linha válida (cdn_niv_cargo > 0 e nome completo são obrigatórios)."); return; }
        setImportRows(parsed); setImportResult(null); setImportOpen(true);
      } catch { toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    let created = 0, updated = 0, errors = 0;
    for (const row of importRows) {
      const existing = rows.find((r) => r.cdnNivCargo === row.cdnNivCargo);
      try {
        const payload = { cdnNivCargo: row.cdnNivCargo, nomReduz: row.nomReduz, nomComplet: row.nomComplet, isActive: row.isActive };
        if (existing) {
          await fetchJson(`/api/nivel-cargo/${existing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          updated++;
        } else {
          await fetchJson("/api/nivel-cargo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          created++;
        }
      } catch { errors++; }
    }
    setImportResult({ created, updated, errors });
    setImporting(false);
    await syncList();
  };

  const exportTsv = () => {
    const csv = [["Código (cdn)", "Nome Reduzido", "Nome Completo", "Status"].join("\t"),
      ...rows.map((x) => [x.cdnNivCargo, x.nomReduz, x.nomComplet, x.isActive ? "Ativo" : "Inativo"].join("\t"))
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/tab-separated-values;charset=utf-8;" }));
    link.download = "nivel-cargo.tsv";
    link.click();
    toast.success("Exportado.");
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Níveis de Cargo</h4>
          <div className="text-muted-foreground text-sm">Cadastro de níveis de cargo TOTVS Datasul (niv_cargo).</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportTsv} title="Exportar TSV">
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
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo nível</span>
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

      {/* Table */}
      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Lista de níveis de cargo</div>
            <div className="text-muted-foreground text-sm">Corresponde à tabela niv_cargo do TOTVS Datasul.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-[220px] pl-8" placeholder="código, nome..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
              <TableHead className="w-24 cursor-pointer select-none" onClick={() => handleSort("codigo")}>Cód. TOTVS<SortIcon col="codigo" /></TableHead>
              <TableHead className="w-28 cursor-pointer select-none" onClick={() => handleSort("reduzido")}>Nome Reduzido<SortIcon col="reduzido" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("completo")}>Nome Completo<SortIcon col="completo" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.cdnNivCargo}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{item.nomReduz}</TableCell>
                <TableCell className="font-semibold">{item.nomComplet}</TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar"
                      onClick={() => { setDraft({ id: item.id, cdnNivCargo: String(item.cdnNivCargo), nomReduz: item.nomReduz, nomComplet: item.nomComplet, isActive: item.isActive }); setEditOpen(true); }}>
                      <Pencil />
                    </Button>
                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum nível de cargo encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar nível de cargo" : "Novo nível de cargo"}</DialogTitle>
            <DialogDescription>Corresponde ao registro niv_cargo no TOTVS Datasul.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código TOTVS (cdn_niv_cargo) *</label>
              <Input
                type="number"
                placeholder="Ex: 1"
                value={draft.cdnNivCargo}
                onChange={(e) => setDraft((d) => ({ ...d, cdnNivCargo: e.target.value }))}
                disabled={!!draft.id}
              />
              {draft.id && <p className="mt-1 text-xs text-muted-foreground">Código não pode ser alterado após criação.</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome reduzido * (máx. 6 caracteres)</label>
              <Input placeholder="Ex: JR" value={draft.nomReduz} onChange={(e) => setDraft((d) => ({ ...d, nomReduz: e.target.value.slice(0, 6) }))} maxLength={6} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome completo * (máx. 40 caracteres)</label>
              <Input placeholder="Ex: Júnior" value={draft.nomComplet} onChange={(e) => setDraft((d) => ({ ...d, nomComplet: e.target.value.slice(0, 40) }))} maxLength={40} />
            </div>
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
            <DialogTitle>Importar Níveis de Cargo</DialogTitle>
            <DialogDescription>
              {importResult
                ? `Concluído: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.`
                : `${importRows.length} registro(s) encontrado(s). Códigos existentes serão atualizados.`}
            </DialogDescription>
          </DialogHeader>
          <ImportGuide entity="Níveis de Cargo" columns={[
            { name: "cdn_niv_cargo", hint: "Código numérico do TOTVS (ex: 1)", required: true },
            { name: "nom_reduz_niv_cargo", hint: "Até 6 caracteres (ex: JR)" },
            { name: "nom_complet_niv_cargo", hint: "Até 40 caracteres (ex: Júnior)", required: true },
            { name: "Status", hint: "Ativo / Inativo" },
          ]} />
          {!importResult && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Cód. TOTVS</th>
                    <th className="px-3 py-2 text-left font-medium">Nome Reduzido</th>
                    <th className="px-3 py-2 text-left font-medium">Nome Completo</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{r.cdnNivCargo}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.nomReduz || "—"}</td>
                      <td className="px-3 py-1.5 font-semibold">{r.nomComplet}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>
                          {r.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {importRows.length > 50 && (
                    <tr className="border-t"><td colSpan={4} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {importRows.length - 50} registro(s)</td></tr>
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

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Excluir o nível <strong>"{deleteTarget?.nomComplet}"</strong>? Se houver cargos vinculados, o vínculo será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!deleteTarget) return;
              try {
                await fetchJson(`/api/nivel-cargo/${deleteTarget.id}`, { method: "DELETE" });
                toast.success("Nível de cargo removido");
                setDeleteTarget(null);
                await syncList();
              } catch { toast.error("Erro ao remover"); }
            }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
