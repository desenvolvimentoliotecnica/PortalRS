"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  FileDown,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

const BASE = "/app";

type UnknownRecord = Record<string, unknown>;

function asRecord(v: unknown): UnknownRecord | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as UnknownRecord) : null;
}

function pickString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function pickBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "ativo", "active"].includes(s)) return true;
    if (["false", "0", "no", "n", "inativo", "inactive"].includes(s)) return false;
  }
  return fallback;
}

function normalizeKey(raw: string | null | undefined) {
  const s = (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!s) return "";
  return s
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function statusBadgeFromActive(isActive: boolean) {
  if (isActive)
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        Ativo
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
      Inativo
    </span>
  );
}

type FuncaoRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  requisitosCount: number;
  vagasCount: number;
};

type FuncaoDraft = {
  id?: string;
  code: string;
  name: string;
  description: string;
  status: "ativo" | "inativo";
};

type VagaLite = {
  id: string;
  codigo: string;
  titulo: string;
  modalidade: string;
  cidade: string;
  uf: string;
  status: string;
  updatedAt: string;
  requisitos: unknown[];
};

function mapVagaLite(v: unknown): VagaLite {
  const r = asRecord(v) ?? {};
  const requisitos = Array.isArray(r.requisitos) ? r.requisitos : [];
  return {
    id: pickString(r.id, ""),
    codigo: pickString(r.codigo ?? r.code, ""),
    titulo: pickString(r.titulo ?? r.title, ""),
    modalidade: pickString(r.modalidade ?? r.mode ?? r.workMode, ""),
    cidade: pickString(r.cidade ?? r.city, ""),
    uf: pickString(r.uf ?? r.Uf ?? r.state, ""),
    status: pickString(r.status, ""),
    updatedAt: pickString(r.updatedAtUtc ?? r.updatedAt ?? r.updated_at, ""),
    requisitos,
  };
}

function vagaLocal(v: VagaLite) {
  return [v.cidade, v.uf].filter(Boolean).join(" - ");
}

function formatDatePtBr(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function requisitoCategoriaKey(req: unknown) {
  const r = asRecord(req) ?? {};
  const cat =
    pickString(
      r.categoria ?? r.category ?? r.Categoria ?? r.Category ?? r.cat ?? r.categoriaCodigo ?? r.categoriaNome,
      "",
    ) || "";
  return normalizeKey(cat);
}

function funcaoFromApi(item: unknown): FuncaoRow | null {
  const r = asRecord(item);
  if (!r) return null;

  const id = pickString(r.id ?? r.Id, "").trim();
  if (!id) return null;

  const code = pickString(r.code ?? r.codigo ?? r.Code, "").trim();
  const name = pickString(r.name ?? r.nome ?? r.Name, "").trim();
  const description = pickString(r.description ?? r.descricao ?? r.Description, "").trim();

  const isActive = pickBool(r.isActive ?? r.IsActive ?? r.active ?? r.ativo ?? r.status, false);

  return { id, code, name, description, isActive, requisitosCount: 0, vagasCount: 0 };
}

const emptyDraft: FuncaoDraft = { code: "", name: "", description: "", status: "ativo" };

export default function FuncoesScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FuncaoRow[]>([]);
  const [vagas, setVagas] = useState<VagaLite[]>([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<FuncaoDraft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FuncaoRow | null>(null);
  const [detailItem, setDetailItem] = useState<FuncaoRow | null>(null);
  const [detailVagas, setDetailVagas] = useState<Array<{ vaga: VagaLite; count: number }> | null>(null);

  const detailCalcSeq = useRef(0);

  const syncAll = useCallback(async () => {
    const [funcoesPayload, vagasPayload] = await Promise.all([
      fetchJson<{ items: unknown[] }>(`/api/requisito-categorias`),
      fetchJson<unknown>(`${BASE}/api/vagas`),
    ]);

    const funcoesRaw = Array.isArray(funcoesPayload?.items) ? funcoesPayload.items : [];
    const funcoes = funcoesRaw.map(funcaoFromApi).filter(Boolean) as FuncaoRow[];

    const vagasList = Array.isArray(vagasPayload)
      ? (vagasPayload as unknown[])
      : Array.isArray(asRecord(vagasPayload)?.items)
        ? ((asRecord(vagasPayload)!.items as unknown[]) ?? [])
        : [];
    const vagaLites = vagasList.map(mapVagaLite).filter((v) => !!v.id);

    // Enrich functions with counts based on vagas.requisitos
    const enriched = funcoes.map((f) => {
      const nameKey = normalizeKey(f.name);
      const codeKey = normalizeKey(f.code);
      if (!nameKey && !codeKey) return { ...f, requisitosCount: 0, vagasCount: 0 };

      let totalReqs = 0;
      let vagasCount = 0;
      for (const v of vagaLites) {
        const reqs = v.requisitos || [];
        let hit = 0;
        for (const req of reqs) {
          const catKey = requisitoCategoriaKey(req);
          if (!catKey) continue;
          if ((nameKey && catKey === nameKey) || (codeKey && catKey === codeKey)) hit++;
        }
        if (hit) {
          vagasCount++;
          totalReqs += hit;
        }
      }
      return { ...f, requisitosCount: totalReqs, vagasCount };
    });

    setRows(enriched);
    setVagas(vagaLites);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    syncAll()
      .catch(() => toast.error("Falha ao carregar funções."))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [syncAll]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((c) => c.isActive).length;
    const vagasArr = vagas ?? [];
    const totalReqs = vagasArr.reduce((acc, v) => acc + (Array.isArray(v.requisitos) ? v.requisitos.length : 0), 0);
    const vagasComReq = vagasArr.filter((v) => (Array.isArray(v.requisitos) ? v.requisitos.length : 0) > 0).length;
    return { total, active, reqs: totalReqs, vagas: vagasComReq };
  }, [rows, vagas]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (statusFilter === "ativo" && !c.isActive) return false;
      if (statusFilter === "inativo" && c.isActive) return false;
      if (!qq) return true;
      const blob = [c.code, c.name, c.description].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(qq);
    });
  }, [q, rows, statusFilter]);

  /* paginação padronizada (client-side) */
  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
    initialPageSize: 20,
    resetDeps: [q, statusFilter],
  });
  const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

  function openNew() {
    setDraft({ ...emptyDraft });
    setEditOpen(true);
  }

  async function openEdit(item: FuncaoRow) {
    try {
      const detail = await fetchJson<unknown>(`/api/requisito-categorias/${item.id}`);
      const r = asRecord(detail) ?? {};
      const isActive = pickBool(r.isActive ?? r.IsActive ?? r.status, item.isActive);
      setDraft({
        id: item.id,
        code: pickString(r.code ?? r.Code, item.code),
        name: pickString(r.name ?? r.Name, item.name),
        description: pickString(r.description ?? r.Description, item.description),
        status: isActive ? "ativo" : "inativo",
      });
      setEditOpen(true);
    } catch {
      toast.error("Falha ao carregar dados.");
    }
  }

  async function saveDraft() {
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error("Código e nome são obrigatórios.");
      return;
    }

    setSaving(true);
    const payload = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      isActive: draft.status === "ativo",
    };

    try {
      if (draft.id) {
        await fetchJson(`/api/requisito-categorias/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Função atualizada.");
      } else {
        await fetchJson(`/api/requisito-categorias`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Função criada.");
      }
      setEditOpen(false);
      await syncAll();
    } catch {
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await fetchJson(`/api/requisito-categorias/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Função excluída.");
      setDeleteTarget(null);
      await syncAll();
    } catch {
      toast.error("Falha ao excluir.");
    }
  }

  function exportCsv() {
    const headers = ["Codigo", "Funcao", "Status", "Descricao"];
    const dataRows = filtered.map((c) => [
      c.code || "",
      c.name || "",
      c.isActive ? "ativo" : "inativo",
      c.description || "",
    ]);

    const csv = [
      headers.map((h) => `"${String(h).replaceAll('"', '""')}"`).join(";"),
      ...dataRows.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";")),
    ].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "funcoes_requisitos_liotecnica.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exportação iniciada.");
  }

  async function reloadWithConfirm() {
    const ok = confirm("Recarregar dados da API?");
    if (!ok) return;
    setLoading(true);
    try {
      await syncAll();
      toast.success("Dados recarregados.");
    } catch {
      toast.error("Falha ao recarregar.");
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(item: FuncaoRow) {
    setDetailItem(item);
    setDetailVagas(null);

    const seq = ++detailCalcSeq.current;
    const fKey = normalizeKey(item.name);
    const cKey = normalizeKey(item.code);

    const related = (vagas ?? [])
      .map((v) => {
        const reqs = v.requisitos || [];
        let count = 0;
        for (const req of reqs) {
          const catKey = requisitoCategoriaKey(req);
          if (!catKey) continue;
          if ((fKey && catKey === fKey) || (cKey && catKey === cKey)) count++;
        }
        if (!count) return null;
        return { vaga: v, count };
      })
      .filter(Boolean) as Array<{ vaga: VagaLite; count: number }>;

    related.sort((a, b) => (a.vaga.titulo || "").localeCompare(b.vaga.titulo || "", "pt-BR"));

    if (seq !== detailCalcSeq.current) return;
    setDetailVagas(related);
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Funções</h4>
          <div className="text-muted-foreground text-sm">
            Cadastro de Funções (PFUNCAO do RM) usadas nos requisitos das vagas.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={exportCsv} title="Exportar funções (CSV)">
            <FileDown className="size-4" />
            <span className="hidden sm:inline ml-1">Exportar</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void reloadWithConfirm()} title="Recarregar dados">
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" />
            <span className="hidden sm:inline ml-1">Nova função</span>
          </Button>
        </div>
      </div>

      {/* KPIs — paridade com Razor */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Funções", value: kpis.total, color: "text-primary" },
          { label: "Ativas", value: kpis.active, color: "text-emerald-600" },
          { label: "Requisitos", value: kpis.reqs, color: "text-primary" },
          { label: "Vagas com requisitos", value: kpis.vagas, color: "text-primary" },
        ].map((k) => (
          <div
            key={k.label}
            className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"
          >
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {k.label}
            </div>
            <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Lista de funções</div>
            <div className="text-muted-foreground text-sm">
              Clique em uma função para ver vagas relacionadas.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-[240px] pl-8"
                placeholder="nome, codigo..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requisitos</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : paged.length ? (
              paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-semibold">{c.name || "—"}</div>
                    <div className="text-muted-foreground text-xs font-mono">{c.code || "—"}</div>
                  </TableCell>
                  <TableCell>{statusBadgeFromActive(c.isActive)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {c.requisitosCount} reqs / {c.vagasCount} vagas
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                    {c.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Detalhes"
                        onClick={() => void openDetails(c)}
                      >
                        <Eye />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Editar"
                        onClick={() => void openEdit(c)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive"
                        title="Excluir"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma função encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Paginação padronizada */}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel="função(ões)"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar função" : "Nova função"}</DialogTitle>
            <DialogDescription>Cadastre dados principais da função.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
              <Input
                placeholder="FUN-XXX"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Função *</label>
              <Input
                placeholder="Ex.: Operador de Máquinas"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as FuncaoDraft["status"] }))}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
              <Input
                placeholder="Resumo do uso da função"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveDraft()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog (vagas relacionadas) */}
      <Dialog
        open={!!detailItem}
        onOpenChange={(open) => {
          if (open) return;
          setDetailItem(null);
          setDetailVagas(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes — {detailItem?.name ?? ""}</DialogTitle>
            <DialogDescription>Vagas relacionadas e contagem de requisitos desta função.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="font-medium">Código:</span> <span className="font-mono">{detailItem?.code || "—"}</span>
            </div>
            <div>
              <span className="font-medium">Status:</span>{" "}
              {detailItem ? statusBadgeFromActive(detailItem.isActive) : null}
            </div>
            <div>
              <span className="font-medium">Requisitos (em vagas):</span> {detailItem?.requisitosCount ?? 0}
            </div>
            <div>
              <span className="font-medium">Vagas relacionadas:</span> {detailItem?.vagasCount ?? 0}
            </div>
            <div className="sm:col-span-2">
              <span className="font-medium">Descrição:</span> {detailItem?.description || "—"}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-2 font-semibold">Vagas relacionadas</div>
            <div className="table-responsive">
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>Vaga</th>
                    <th style={{ width: 160 }}>Requisitos</th>
                    <th style={{ width: 130 }}>Atualizado</th>
                    <th style={{ width: 120 }} className="text-end">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailVagas === null ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        Carregando…
                      </td>
                    </tr>
                  ) : detailVagas.length ? (
                    detailVagas.map(({ vaga, count }) => (
                      <tr key={vaga.id}>
                        <td>
                          <div className="fw-bold">{vaga.titulo || "—"}</div>
                          <div className="text-muted small">
                            <span className="mono">{vaga.codigo || "—"}</span>
                            {vaga.modalidade ? (
                              <>
                                <span className="mx-2">•</span>
                                <span>{vaga.modalidade}</span>
                              </>
                            ) : null}
                            {vagaLocal(vaga) ? (
                              <>
                                <span className="mx-2">•</span>
                                <span>{vagaLocal(vaga)}</span>
                              </>
                            ) : null}
                            {vaga.status ? (
                              <>
                                <span className="mx-2">•</span>
                                <span>{vaga.status}</span>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="nowrap font-mono">{count}</td>
                        <td className="nowrap">{formatDatePtBr(vaga.updatedAt)}</td>
                        <td className="text-end nowrap">
                          <button
                            className="btn-ghost px-3 py-2"
                            type="button"
                            onClick={() => {
                              window.location.href = `${BASE}/vagas?vagaId=${encodeURIComponent(vaga.id)}&open=detail`;
                            }}
                            title="Abrir vaga"
                          >
                            Abrir vaga
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        Nenhuma vaga relacionada encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailItem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Excluir a função <strong>&quot;{deleteTarget?.name ?? ""}&quot;</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

