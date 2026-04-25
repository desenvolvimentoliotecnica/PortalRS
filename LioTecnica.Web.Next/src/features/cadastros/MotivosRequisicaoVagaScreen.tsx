"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Power, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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

type EfeitoHeadcount = "Aumenta" | "Diminui" | "Ambos";

interface Item {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  efeitoHeadcount: EfeitoHeadcount;
  isActive: boolean;
  ordem: number;
  isSystem: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface Draft {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  efeitoHeadcount: EfeitoHeadcount;
  isActive: boolean;
  ordem: number;
  isSystem: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // extrai mensagem do backend { message: "..." }
    let message = t;
    try { const parsed = JSON.parse(t); if (parsed?.message) message = parsed.message; } catch { /* ignore */ }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

const EFEITOS: { value: EfeitoHeadcount; label: string; badge: string; hint: string }[] = [
  { value: "Aumenta", label: "Aumenta (+1)", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", hint: "Entra alguém; ninguém sai." },
  { value: "Diminui", label: "Diminui (-1)", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400",         hint: "Sai alguém; ninguém entra." },
  { value: "Ambos",   label: "Ambos (0 líquido)", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400",       hint: "Sai um e entra outro (reposição)." },
];

function efeitoBadge(e: EfeitoHeadcount) {
  const info = EFEITOS.find((x) => x.value === e) ?? EFEITOS[0];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.badge}`}>{info.label}</span>;
}

function statusBadge(active: boolean) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>
  );
}

const emptyDraft: Draft = {
  codigo: "", nome: "", descricao: "",
  efeitoHeadcount: "Aumenta",
  isActive: true,
  ordem: 0,
  isSystem: false,
};

const API = "/api/motivos-requisicao-vaga";

export default function MotivosRequisicaoVagaScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [efeitoFilter, setEfeitoFilter] = useState<"all" | EfeitoHeadcount>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const syncList = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchJson<Item[]>(API);
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Erro ao carregar motivos de requisição");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncList(); }, [syncList]);

  type SortKey = "codigo" | "nome" | "efeito" | "ordem" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("ordem");
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
      if (efeitoFilter !== "all" && x.efeitoHeadcount !== efeitoFilter) return false;
      if (!q) return true;
      return x.codigo.toLowerCase().includes(q) || x.nome.toLowerCase().includes(q);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      switch (sortKey) {
        case "codigo": return dir * a.codigo.localeCompare(b.codigo, "pt-BR");
        case "nome":   return dir * a.nome.localeCompare(b.nome, "pt-BR");
        case "efeito": return dir * a.efeitoHeadcount.localeCompare(b.efeitoHeadcount);
        case "ordem":  return dir * (a.ordem - b.ordem);
        case "status": return dir * (Number(b.isActive) - Number(a.isActive));
        default: return 0;
      }
    });
  }, [search, statusFilter, efeitoFilter, rows, sortKey, sortDir]);

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
    initialPageSize: 20,
    resetDeps: [search, statusFilter, efeitoFilter, sortKey, sortDir],
  });
  const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.start, slice.end]);

  const kpis = useMemo(() => ({
    total: rows.length,
    ativos: rows.filter((r) => r.isActive).length,
    aumenta: rows.filter((r) => r.efeitoHeadcount === "Aumenta").length,
    diminui: rows.filter((r) => r.efeitoHeadcount === "Diminui").length,
    ambos: rows.filter((r) => r.efeitoHeadcount === "Ambos").length,
  }), [rows]);

  const save = async () => {
    if (!draft.codigo.trim() || !draft.nome.trim()) { toast.error("Código e nome são obrigatórios"); return; }
    try {
      setSaving(true);
      const payload = {
        codigo: draft.codigo.trim(),
        nome: draft.nome.trim(),
        descricao: draft.descricao?.trim() || null,
        efeitoHeadcount: draft.efeitoHeadcount,
        isActive: draft.isActive,
        ordem: Number.isFinite(draft.ordem) ? draft.ordem : 0,
      };
      if (draft.id) {
        await fetchJson(`${API}/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Motivo atualizado");
      } else {
        await fetchJson(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Motivo criado");
      }
      setEditOpen(false);
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar motivo");
    } finally { setSaving(false); }
  };

  const toggleActive = async (item: Item) => {
    try {
      await fetchJson(`${API}/${item.id}/toggle-active`, { method: "PATCH" });
      toast.success(item.isActive ? "Motivo desativado" : "Motivo ativado");
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Motivos de Requisição de Vaga</h4>
          <div className="text-muted-foreground text-sm">
            Parametrize os motivos que aparecem no formulário de solicitação de vaga e como eles afetam o quadro de headcount.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }} data-testid="btn-novo-motivo">
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo motivo</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativos", value: kpis.ativos, color: "text-emerald-600" },
          { label: "Aumenta HC", value: kpis.aumenta, color: "text-emerald-600" },
          { label: "Diminui HC", value: kpis.diminui, color: "text-rose-600" },
          { label: "Ambos", value: kpis.ambos, color: "text-sky-600" },
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
            <div className="font-semibold">Lista de motivos</div>
            <div className="text-muted-foreground text-sm">Clique em editar para alterar um registro. Motivos marcados como "sistema" não podem ser excluídos (apenas desativados).</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-[220px] pl-8" placeholder="código, nome..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} data-testid="search-motivos" />
            </div>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={efeitoFilter} onChange={(e) => { setEfeitoFilter(e.target.value as "all" | EfeitoHeadcount); setPage(1); }}>
              <option value="all">Todos os efeitos</option>
              <option value="Aumenta">Aumenta HC</option>
              <option value="Diminui">Diminui HC</option>
              <option value="Ambos">Ambos</option>
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("ordem")}>#<SortIcon col="ordem" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("codigo")}>Código<SortIcon col="codigo" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>Nome<SortIcon col="nome" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("efeito")}>Efeito no HC<SortIcon col="efeito" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id} data-testid={`row-motivo-${item.codigo}`}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{item.ordem}</TableCell>
                <TableCell className="font-mono text-sm">
                  {item.codigo}
                  {item.isSystem && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">sistema</span>}
                </TableCell>
                <TableCell className="font-semibold">{item.nome}</TableCell>
                <TableCell>{efeitoBadge(item.efeitoHeadcount)}</TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title={item.isActive ? "Desativar" : "Ativar"} onClick={() => toggleActive(item)}>
                      <Power />
                    </Button>
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => {
                      setDraft({
                        id: item.id,
                        codigo: item.codigo,
                        nome: item.nome,
                        descricao: item.descricao ?? "",
                        efeitoHeadcount: item.efeitoHeadcount,
                        isActive: item.isActive,
                        ordem: item.ordem,
                        isSystem: item.isSystem,
                      });
                      setEditOpen(true);
                    }} data-testid={`btn-editar-${item.codigo}`}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      title={item.isSystem ? "Motivo de sistema — use 'Desativar'" : "Excluir"}
                      disabled={item.isSystem}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum motivo encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar motivo" : "Novo motivo"}</DialogTitle>
            <DialogDescription>Defina o nome do motivo e como ele afeta o headcount do quadro.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código * <span className="text-muted-foreground/70">(usado por integrações)</span></label>
              <Input
                placeholder="Ex: PromocaoInterna"
                value={draft.codigo}
                onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value }))}
                maxLength={60}
                disabled={draft.isSystem}
                data-testid="input-codigo"
              />
              {draft.isSystem && <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Código fixo para motivos do sistema.</div>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label>
              <Input
                placeholder="Ex: Promoção interna"
                value={draft.nome}
                onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                maxLength={120}
                data-testid="input-nome"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Quando usar este motivo? (opcional)"
                value={draft.descricao}
                onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))}
                maxLength={500}
                rows={3}
                data-testid="input-descricao"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Efeito no headcount *</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {EFEITOS.map((ef) => (
                  <label
                    key={ef.value}
                    className={`flex cursor-pointer flex-col gap-1 rounded-md border p-2.5 text-sm transition ${draft.efeitoHeadcount === ef.value ? "border-primary bg-primary/5" : "border-input"}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="efeito"
                        checked={draft.efeitoHeadcount === ef.value}
                        onChange={() => setDraft((d) => ({ ...d, efeitoHeadcount: ef.value }))}
                        data-testid={`radio-efeito-${ef.value.toLowerCase()}`}
                      />
                      <span className="font-semibold">{ef.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{ef.hint}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Ordem</label>
              <Input
                type="number"
                value={draft.ordem}
                onChange={(e) => setDraft((d) => ({ ...d, ordem: e.target.value === "" ? 0 : Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.isActive ? "ativo" : "inativo"}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "ativo" }))}
                data-testid="select-status"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="btn-salvar-motivo">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Excluir o motivo <strong>&quot;{deleteTarget?.nome}&quot;</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await fetchJson(`${API}/${deleteTarget.id}`, { method: "DELETE" });
                  toast.success("Motivo removido");
                  setDeleteTarget(null);
                  await syncList();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao remover");
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
