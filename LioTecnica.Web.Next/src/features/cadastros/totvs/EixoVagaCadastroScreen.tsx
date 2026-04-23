"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  name: string;
  description?: string | null;
  slaDiasMetaFechamento?: number | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface Draft {
  id?: string;
  code: string;
  name: string;
  description: string;
  slaDiasMetaFechamento: string;
  isActive: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${t || res.statusText}`);
  }
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

const emptyDraft: Draft = { code: "", name: "", description: "", slaDiasMetaFechamento: "", isActive: true };

export default function EixoVagaCadastroScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const syncList = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchJson<Item[]>("/api/eixos-vaga?take=5000");
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Erro ao carregar eixos de vaga");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncList(); }, [syncList]);

  type SortKey = "code" | "name" | "sla" | "status";
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
      return x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)
        || (x.description ?? "").toLowerCase().includes(q);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      switch (sortKey) {
        case "code": return dir * a.code.localeCompare(b.code, "pt-BR");
        case "name": return dir * a.name.localeCompare(b.name, "pt-BR");
        case "sla": return dir * ((a.slaDiasMetaFechamento ?? Number.POSITIVE_INFINITY) - (b.slaDiasMetaFechamento ?? Number.POSITIVE_INFINITY));
        case "status": return dir * (Number(b.isActive) - Number(a.isActive));
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
    comSla: rows.filter((r) => r.slaDiasMetaFechamento != null).length,
  }), [rows]);

  const save = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error("Código e nome são obrigatórios");
      return;
    }
    const slaRaw = draft.slaDiasMetaFechamento.trim();
    let slaValue: number | null = null;
    if (slaRaw) {
      const parsed = Number(slaRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        toast.error("SLA deve ser um número inteiro positivo de dias");
        return;
      }
      slaValue = parsed;
    }
    try {
      setSaving(true);
      const payload = {
        code: draft.code.trim(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        slaDiasMetaFechamento: slaValue,
        isActive: draft.isActive,
      };
      if (draft.id) {
        await fetchJson(`/api/eixos-vaga/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Eixo atualizado");
      } else {
        await fetchJson("/api/eixos-vaga", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Eixo criado");
      }
      setEditOpen(false);
      await syncList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error(`Erro ao salvar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await fetchJson(`/api/eixos-vaga/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Eixo removido");
      setDeleteTarget(null);
      await syncList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error(`Erro ao remover: ${msg}`);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Eixos de Vaga</h4>
          <div className="text-muted-foreground text-sm">Categorização estratégica de vagas (ex.: Tech, Comercial). Configure SLA por eixo para sobrepor o SLA global.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}>
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo eixo</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativos", value: kpis.ativos, color: "text-emerald-600" },
          { label: "Com SLA", value: kpis.comSla, color: "text-blue-600" },
          { label: "Exibindo", value: filtered.length, color: "text-primary" },
        ].map((k) => (
          <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
            <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Lista de eixos</div>
            <div className="text-muted-foreground text-sm">Vagas apontam para um eixo e usam seu SLA como override.</div>
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
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("code")}>Código<SortIcon col="code" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>Nome<SortIcon col="name" /></TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("sla")}>SLA (dias)<SortIcon col="sla" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm text-muted-foreground">{item.code}</TableCell>
                <TableCell className="font-semibold">{item.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.description ?? ""}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {item.slaDiasMetaFechamento != null ? item.slaDiasMetaFechamento : <span className="italic text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => {
                      setDraft({
                        id: item.id,
                        code: item.code,
                        name: item.name,
                        description: item.description ?? "",
                        slaDiasMetaFechamento: item.slaDiasMetaFechamento != null ? String(item.slaDiasMetaFechamento) : "",
                        isActive: item.isActive,
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
            )) : (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum eixo encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar eixo" : "Novo eixo"}</DialogTitle>
            <DialogDescription>Categorize vagas por eixo estratégico. SLA (opcional) sobrepõe o SLA global do tenant.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input placeholder="Ex: TECH" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={30} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label>
              <Input placeholder="Ex: Tecnologia" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={120} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="..." value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={400} rows={3} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">SLA (dias)</label>
              <Input type="number" min={1} placeholder="Vazio = usa SLA global" value={draft.slaDiasMetaFechamento} onChange={(e) => setDraft((d) => ({ ...d, slaDiasMetaFechamento: e.target.value }))} />
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Excluir o eixo <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>? Se estiver em uso por alguma vaga, a operação será bloqueada — prefira desativar.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
