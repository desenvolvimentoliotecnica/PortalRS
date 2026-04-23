"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
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
  title: string;
  summary?: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  niceToHave?: string | null;
  benefits?: string | null;
  isTemplate: boolean;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  nivelCargoId?: string | null;
  nivelCargoNome?: string | null;
}

interface Draft {
  id?: string;
  code: string;
  title: string;
  summary: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  benefits: string;
  isTemplate: boolean;
  isActive: boolean;
  nivelCargoId: string;
}

interface NivelCargoOption {
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

const emptyDraft: Draft = {
  code: "", title: "", summary: "",
  responsibilities: "", requirements: "", niceToHave: "", benefits: "",
  isTemplate: false, isActive: true, nivelCargoId: "",
};

export default function DescricaoCargoCadastroScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [niveis, setNiveis] = useState<NivelCargoOption[]>([]);
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState<"all" | "template" | "direto">("all");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const syncList = useCallback(async () => {
    try {
      setLoading(true);
      const [items, niveisRes] = await Promise.all([
        fetchJson<Item[]>("/api/descricoes-cargo?take=2000"),
        fetchJson<Array<{ id: string; nomReduz?: string; nomComplet?: string; cdnNivCargo?: number }>>("/api/niveis-cargo?take=2000").catch(() => []),
      ]);
      setRows(Array.isArray(items) ? items : []);
      setNiveis(
        Array.isArray(niveisRes)
          ? niveisRes.map((n) => ({
              id: n.id,
              code: String(n.cdnNivCargo ?? ""),
              description: n.nomComplet || n.nomReduz || "",
            }))
          : []
      );
    } catch {
      toast.error("Erro ao carregar descrições de cargo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncList(); }, [syncList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((x) => {
      if (templateFilter === "template" && !x.isTemplate) return false;
      if (templateFilter === "direto" && x.isTemplate) return false;
      if (!q) return true;
      return x.code.toLowerCase().includes(q) || x.title.toLowerCase().includes(q);
    });
  }, [search, templateFilter, rows]);

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
    initialPageSize: 20,
    resetDeps: [search, templateFilter],
  });
  const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.start, slice.end]);

  const kpis = useMemo(() => ({
    total: rows.length,
    templates: rows.filter((r) => r.isTemplate).length,
    ativos: rows.filter((r) => r.isActive).length,
  }), [rows]);

  const save = async () => {
    if (!draft.code.trim() || !draft.title.trim()) {
      toast.error("Código e título são obrigatórios");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        code: draft.code.trim(),
        title: draft.title.trim(),
        summary: draft.summary?.trim() || null,
        responsibilities: draft.responsibilities?.trim() || null,
        requirements: draft.requirements?.trim() || null,
        niceToHave: draft.niceToHave?.trim() || null,
        benefits: draft.benefits?.trim() || null,
        isTemplate: draft.isTemplate,
        isActive: draft.isActive,
        nivelCargoId: draft.nivelCargoId || null,
      };
      if (draft.id) {
        await fetchJson(`/api/descricoes-cargo/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Descrição atualizada");
      } else {
        await fetchJson("/api/descricoes-cargo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Descrição criada");
      }
      setEditOpen(false);
      await syncList();
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Descrição de Cargos</h4>
          <div className="text-muted-foreground text-sm">
            Conteúdo rico reutilizado na criação de vagas. Templates ficam vinculados a um Cargo Macro.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}>
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Nova descrição</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Templates", value: kpis.templates, color: "text-indigo-600" },
          { label: "Ativas", value: kpis.ativos, color: "text-emerald-600" },
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
            <div className="font-semibold">Lista de descrições</div>
            <div className="text-muted-foreground text-sm">Use a coluna Tipo para identificar templates reutilizáveis.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-[220px] pl-8" placeholder="código, título..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={templateFilter} onChange={(e) => { setTemplateFilter(e.target.value as "all" | "template" | "direto"); setPage(1); }}>
              <option value="all">Todos</option>
              <option value="template">Somente templates</option>
              <option value="direto">Uso direto</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cargo Macro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm text-muted-foreground">{item.code}</TableCell>
                <TableCell className="font-semibold">{item.title}</TableCell>
                <TableCell className="text-sm">
                  {item.nivelCargoNome || <span className="italic text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {item.isTemplate ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">Template</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Uso direto</span>
                  )}
                </TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      title="Editar"
                      onClick={() => {
                        setDraft({
                          id: item.id,
                          code: item.code,
                          title: item.title,
                          summary: item.summary || "",
                          responsibilities: item.responsibilities || "",
                          requirements: item.requirements || "",
                          niceToHave: item.niceToHave || "",
                          benefits: item.benefits || "",
                          isTemplate: item.isTemplate,
                          isActive: item.isActive,
                          nivelCargoId: item.nivelCargoId || "",
                        });
                        setEditOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma descrição encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar descrição de cargo" : "Nova descrição de cargo"}</DialogTitle>
            <DialogDescription>
              Preencha o conteúdo que será reutilizado na criação de vagas. Campos de texto aceitam HTML básico vindo do editor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={30} placeholder="DC-0001" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
              <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={200} placeholder="Analista de Produto Pleno" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Missão / Resumo</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                maxLength={2000}
                value={draft.summary}
                onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                placeholder="Resumo do propósito do cargo (1-2 parágrafos)"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Responsabilidades</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                rows={5}
                value={draft.responsibilities}
                onChange={(e) => setDraft((d) => ({ ...d, responsibilities: e.target.value }))}
                placeholder="<ul><li>...</li></ul> ou Markdown"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Requisitos</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                rows={5}
                value={draft.requirements}
                onChange={(e) => setDraft((d) => ({ ...d, requirements: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Diferenciais</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                rows={4}
                value={draft.niceToHave}
                onChange={(e) => setDraft((d) => ({ ...d, niceToHave: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Benefícios</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                rows={3}
                value={draft.benefits}
                onChange={(e) => setDraft((d) => ({ ...d, benefits: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo Macro (opcional)</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.nivelCargoId}
                onChange={(e) => setDraft((d) => ({ ...d, nivelCargoId: e.target.value }))}
              >
                <option value="">— Nenhum —</option>
                {niveis.map((n) => (
                  <option key={n.id} value={n.id}>{n.code} — {n.description}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isTemplate}
                  onChange={(e) => setDraft((d) => ({ ...d, isTemplate: e.target.checked }))}
                />
                Marcar como template
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                />
                Ativo
              </label>
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
            <DialogDescription>Excluir a descrição <strong>"{deleteTarget?.title}"</strong>? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await fetchJson(`/api/descricoes-cargo/${deleteTarget.id}`, { method: "DELETE" });
                  toast.success("Descrição removida");
                  setDeleteTarget(null);
                  await syncList();
                } catch { toast.error("Erro ao remover"); }
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
