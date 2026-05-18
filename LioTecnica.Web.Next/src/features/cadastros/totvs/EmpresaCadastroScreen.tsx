"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Upload, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import { lookupCep } from "@/lib/cepLookup";

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
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodificadoEmUtc?: string | null;
}

interface Draft {
  id?: string;
  code: string;
  description: string;
  isActive: boolean;
  // Sessão 31.8 — endereço (alimenta geocoding p/ matching por distância)
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  // Coords são read-only no UI — exibidas pra debug
  latitude: number | null;
  longitude: number | null;
  geocodificadoEmUtc: string | null;
}

interface ImportRow {
  code: string;
  description: string;
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
  cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "",
  latitude: null, longitude: null, geocodificadoEmUtc: null,
};

export default function EmpresaCadastroScreen() {
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
      const items = await fetchJson<Item[]>("/api/empresas?take=500");
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Erro ao carregar empresas");
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

  const applyGeocodeFromResponse = (saved: Item) => {
    setDraft((d) => ({
      ...d,
      latitude: saved.latitude ?? null,
      longitude: saved.longitude ?? null,
      geocodificadoEmUtc: saved.geocodificadoEmUtc ?? null,
    }));
  };

  const save = async () => {
    if (!draft.code.trim() || !draft.description.trim()) { toast.error("Código e descrição são obrigatórios"); return; }
    try {
      setSaving(true);
      const payload = {
        code: draft.code.trim(),
        description: draft.description.trim(),
        isActive: draft.isActive,
        cep: draft.cep.trim() || null,
        logradouro: draft.logradouro.trim() || null,
        numero: draft.numero.trim() || null,
        bairro: draft.bairro.trim() || null,
        cidade: draft.cidade.trim() || null,
        uf: draft.uf.trim().toUpperCase() || null,
      };
      let saved: Item;
      if (draft.id) {
        saved = await fetchJson<Item>(`/api/empresas/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Empresa atualizada");
      } else {
        saved = await fetchJson<Item>("/api/empresas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Empresa criada");
      }
      applyGeocodeFromResponse(saved);
      if ((saved.cidade || saved.cep) && saved.latitude == null) {
        toast.warning(
          "Endereço salvo, mas latitude/longitude não foram obtidas. Use «Geocodificar agora» ou confira se o servidor acessa nominatim.openstreetmap.org.",
        );
      }
      setEditOpen(false);
      await syncList();
    } catch { toast.error("Erro ao salvar empresa"); }
    finally { setSaving(false); }
  };

  const geocodificarAgora = async () => {
    if (!draft.id) {
      toast.error("Salve a empresa antes de geocodificar.");
      return;
    }
    if (!draft.cidade.trim() && !draft.cep.trim()) {
      toast.error("Informe pelo menos cidade ou CEP.");
      return;
    }
    try {
      setSaving(true);
      const saved = await fetchJson<Item>(`/api/empresas/${draft.id}/geocodificar`, { method: "POST" });
      applyGeocodeFromResponse(saved);
      toast.success(`Geocodificado: ${saved.latitude?.toFixed(6)}, ${saved.longitude?.toFixed(6)}`);
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao geocodificar");
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
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (raw.length === 0) { toast.error("Planilha vazia."); return; }
        const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const parsed: ImportRow[] = raw.map((r) => {
          const key = (variants: string[]) => { const f = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v))); return f ? String(r[f] ?? "").trim() : ""; };
          const statusStr = key(["status", "ativo", "ativa"]).toLowerCase();
          return {
            code: key(["codigo", "code"]),
            description: key(["descricao", "description", "nome", "name"]),
            isActive: statusStr !== "inativo" && statusStr !== "inactive",
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
    const existingMap = new Map(rows.map((r) => [r.code.toLowerCase(), r.id]));
    let created = 0, updated = 0, errors = 0;
    for (const row of importRows) {
      try {
        const existingId = existingMap.get(row.code.toLowerCase());
        const existing = existingId ? rows.find((r) => r.id === existingId) : undefined;
        const payload = {
          code: row.code,
          description: row.description,
          isActive: row.isActive,
          cep: existing?.cep ?? null,
          logradouro: existing?.logradouro ?? null,
          numero: existing?.numero ?? null,
          bairro: existing?.bairro ?? null,
          cidade: existing?.cidade ?? null,
          uf: existing?.uf ?? null,
        };
        if (existingId) {
          await fetchJson(`/api/empresas/${existingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); updated++;
        } else {
          await fetchJson("/api/empresas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); created++;
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
          <h4 className="text-lg font-bold">Empresas</h4>
          <div className="text-muted-foreground text-sm">Cadastro de empresas (agrupador de estabelecimentos).</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" /><span className="hidden sm:inline ml-1">Importar</span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}>
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Nova empresa</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativas", value: kpis.ativos, color: "text-emerald-600" },
          { label: "Inativas", value: kpis.total - kpis.ativos, color: "text-zinc-500" },
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
            <div className="font-semibold">Lista de empresas</div>
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
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("code")}>Código<SortIcon col="code" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("description")}>Nome<SortIcon col="description" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium">{item.code}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => {
                      setDraft({
                        id: item.id,
                        code: item.code,
                        description: item.description,
                        isActive: item.isActive,
                        cep: item.cep ?? "",
                        logradouro: item.logradouro ?? "",
                        numero: item.numero ?? "",
                        bairro: item.bairro ?? "",
                        cidade: item.cidade ?? "",
                        uf: item.uf ?? "",
                        latitude: item.latitude ?? null,
                        longitude: item.longitude ?? null,
                        geocodificadoEmUtc: item.geocodificadoEmUtc ?? null,
                      });
                      setEditOpen(true);
                    }}>
                      <Pencil />
                    </Button>
                    <Button variant="destructive" size="icon-xs" title="Desativar" onClick={() => setDeleteTarget(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma empresa encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>Preencha os dados da empresa. O endereço alimenta o cálculo de distância candidato × empresa no matching.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input placeholder="Ex: EMP001" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={30} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição *</label>
              <Input placeholder="Ex: Matriz SP" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={120} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.isActive ? "ativo" : "inativo"} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "ativo" }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          {/* Endereço (Sessão 31.8) */}
          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço (geocodificado para matching por distância)</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">CEP</label>
                <Input
                  placeholder="01310-100"
                  value={draft.cep}
                  onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))}
                  onBlur={async () => {
                    // Sessão 31.8 — auto-preenche endereço via ViaCEP
                    const res = await lookupCep(draft.cep);
                    if (!res) return;
                    setDraft((d) => ({
                      ...d,
                      // Só preenche se o campo estiver vazio (não sobrescreve edição manual)
                      logradouro: d.logradouro.trim() || res.logradouro,
                      bairro: d.bairro.trim() || res.bairro,
                      cidade: d.cidade.trim() || res.cidade,
                      uf: d.uf.trim() || res.uf,
                    }));
                    toast.success(`Endereço preenchido a partir do CEP`);
                  }}
                  maxLength={20}
                  title="Sair do campo (Tab) busca o endereço automaticamente"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Logradouro</label>
                <Input placeholder="Avenida Paulista" value={draft.logradouro} onChange={(e) => setDraft((d) => ({ ...d, logradouro: e.target.value }))} maxLength={200} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Número</label>
                <Input placeholder="1000" value={draft.numero} onChange={(e) => setDraft((d) => ({ ...d, numero: e.target.value }))} maxLength={40} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Bairro</label>
                <Input placeholder="Bela Vista" value={draft.bairro} onChange={(e) => setDraft((d) => ({ ...d, bairro: e.target.value }))} maxLength={120} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cidade</label>
                <Input placeholder="São Paulo" value={draft.cidade} onChange={(e) => setDraft((d) => ({ ...d, cidade: e.target.value }))} maxLength={120} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">UF</label>
                <Input placeholder="SP" value={draft.uf} onChange={(e) => setDraft((d) => ({ ...d, uf: e.target.value.toUpperCase() }))} maxLength={2} />
              </div>
            </div>
            {draft.latitude != null && draft.longitude != null && (
              <div className="text-xs text-muted-foreground bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                <strong>Geocodificado:</strong> {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}
                {draft.geocodificadoEmUtc && (
                  <span className="ml-2">(em {new Date(draft.geocodificadoEmUtc).toLocaleString("pt-BR")})</span>
                )}
              </div>
            )}
            {draft.latitude == null && (draft.cep || draft.cidade) && (
              <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                Sem coordenadas. Ao salvar tentamos Nominatim (OpenStreetMap). Se continuar vazio, use «Geocodificar agora» — comum em dados vindos de SQL/importação ou quando o servidor não alcança o Nominatim.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            {draft.id && (draft.cep || draft.cidade) && draft.latitude == null && (
              <Button type="button" variant="secondary" onClick={() => void geocodificarAgora()} disabled={saving}>
                Geocodificar agora
              </Button>
            )}
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) { setImportOpen(open); if (!open) { setImportRows([]); setImportResult(null); } } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Empresas</DialogTitle>
            <DialogDescription>
              {importResult
                ? `Concluído: ${importResult.created} criadas, ${importResult.updated} atualizadas${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.`
                : `${importRows.length} registro(s) encontrado(s). Códigos existentes serão atualizados.`}
            </DialogDescription>
          </DialogHeader>
          <ImportGuide entity="Empresas" columns={[
            { name: "Codigo", hint: "Ex: EMP001", required: true },
            { name: "Descricao", hint: "Ex: Matriz São Paulo", required: true },
            { name: "Status", hint: "Ativo / Inativo" },
          ]} />
          {!importResult && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>{r.isActive ? "Ativo" : "Inativo"}</span></td>
                    </tr>
                  ))}
                  {importRows.length > 50 && <tr className="border-t"><td colSpan={3} className="px-3 py-2 text-center text-muted-foreground text-xs">… e mais {importRows.length - 50} registro(s)</td></tr>}
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

      {/* Delete/Deactivate Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar desativação</DialogTitle>
            <DialogDescription>Desativar a empresa <strong>"{deleteTarget?.description}"</strong>? Os estabelecimentos vinculados não serão afetados.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { if (!deleteTarget) return; try { await fetchJson(`/api/empresas/${deleteTarget.id}`, { method: "DELETE" }); toast.success("Empresa desativada"); setDeleteTarget(null); await syncList(); } catch { toast.error("Erro ao desativar"); } }}>Desativar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
