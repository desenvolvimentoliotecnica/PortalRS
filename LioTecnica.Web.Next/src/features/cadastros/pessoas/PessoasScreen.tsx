"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, RefreshCw, Pencil, UserX, Unlock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";



type PessoaListItem = {
  id: string;
  nome: string;
  email: string;
  fone: string | null;
  cidade: string | null;
  uf: string | null;
  origem: number;
  createdAtUtc: string;
  estaBloqueado: boolean;
  bloqueioId: string | null;
};

type PessoasPagedResponse = {
  items: PessoaListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

type PessoaResponse = {
  id: string;
  nome: string;
  email: string;
  fone: string | null;
  cidade: string | null;
  uf: string | null;
  linkedinUrl: string | null;
  resumoProfissional: string | null;
  obs: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cpf: string | null;
  rg: string | null;
  foneContato: string | null;
  dataNascimento: string | null;
  origem: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type EntityChangeListItem = {
  id: string;
  occurredAt: string;
  state: string;
  entityName: string;
  userName: string | null;
  changedColumns: string | null;
};

type EntityChangesResponse = {
  items: EntityChangeListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZES = [10, 20, 50, 100] as const;

const ORIGEM_PESSOA_OPTIONS: { value: number; text: string }[] = [
  { value: 0, text: "Manual" },
  { value: 1, text: "Talento" },
  { value: 2, text: "Vaga" },
  { value: 3, text: "Email" },
  { value: 4, text: "Site" },
  { value: 5, text: "Candidatura" },
  { value: 6, text: "Pasta" },
  { value: 7, text: "Funcionário" },
  { value: 8, text: "Outro" },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = `HTTP ${res.status}: ${text || res.statusText}`;
    console.error(`[apiFetch] ${init?.method ?? "GET"} ${url} → ${msg}`);
    throw new Error(msg);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function stateLabel(state: string | null | undefined) {
  const s = (state ?? "").toLowerCase();
  if (s === "added") return "Criado";
  if (s === "modified") return "Alterado";
  if (s === "deleted") return "Removido";
  return state || "—";
}

function blockedBadge(v: boolean) {
  return v ? (
    <span className="inline-flex items-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
      Sim
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
      Não
    </span>
  );
}

type TabKey = "dados" | "endereco" | "docs" | "historico";

const emptyPessoa: PessoaResponse = {
  id: "",
  nome: "",
  email: "",
  fone: null,
  cidade: null,
  uf: null,
  linkedinUrl: null,
  resumoProfissional: null,
  obs: null,
  cep: null,
  logradouro: null,
  numero: null,
  bairro: null,
  complemento: null,
  cpf: null,
  rg: null,
  foneContato: null,
  dataNascimento: null,
  origem: 0,
  createdAtUtc: "",
  updatedAtUtc: "",
};

export default function PessoasScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PessoaListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("dados");
  const [draft, setDraft] = useState<PessoaResponse>({ ...emptyPessoa });

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<EntityChangeListItem[]>([]);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<PessoaListItem | null>(null);
  const [blockMotivo, setBlockMotivo] = useState("");
  const [blocking, setBlocking] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualMotivo, setManualMotivo] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))), [totalCount, pageSize]);

  const syncList = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));
    const qq = q.trim();
    if (qq) qs.set("q", qq);

    const payload = await fetchJson<PessoasPagedResponse>(`/api/pessoas?${qs.toString()}`);
    const list = Array.isArray(payload?.items) ? payload.items : [];

    setItems(list);
    setTotalCount(Number(payload?.totalCount ?? list.length) || 0);

    const nextPage = Number(payload?.page ?? page) || page;
    const nextPageSize = Number(payload?.pageSize ?? pageSize) || pageSize;
    if (nextPage !== page) setPage(nextPage);
    if (nextPageSize !== pageSize) setPageSize(nextPageSize);
  }, [page, pageSize, q]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQ(qInput);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    syncList()
      .catch((e) => { console.error("Pessoas – load error", e); toast.error(`Falha ao carregar pessoas: ${e instanceof Error ? e.message : "erro"}`); })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [syncList]);

  async function loadHistory(pessoaId: string) {
    setHistoryLoading(true);
    setHistoryItems([]);
    try {
      const qs = new URLSearchParams();
      qs.set("entityName", "Pessoa");
      qs.set("entityId", pessoaId);
      qs.set("page", "1");
      qs.set("pageSize", "50");
      const payload = await fetchJson<EntityChangesResponse | unknown>(`/api/audit/entity-changes?${qs.toString()}`);
      const r = (payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}) as Record<string, unknown>;
      const list = Array.isArray(r.items) ? (r.items as EntityChangeListItem[]) : [];
      setHistoryItems(list);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openEdit(id: string) {
    setEditOpen(true);
    setSaving(false);
    setTab("dados");
    setDraft({ ...emptyPessoa, id });
    setHistoryItems([]);

    try {
      const p = await fetchJson<PessoaResponse>(`/api/pessoas/${encodeURIComponent(id)}`);
      setDraft(p);
    } catch {
      toast.error("Falha ao carregar pessoa.");
    }

    void loadHistory(id);
  }

  function buildPayload(p: PessoaResponse) {
    return {
      nome: (p.nome ?? "").trim(),
      email: (p.email ?? "").trim(),
      fone: (p.fone ?? "").trim() || null,
      cidade: (p.cidade ?? "").trim() || null,
      uf: (p.uf ?? "").trim().toUpperCase().slice(0, 2) || null,
      linkedinUrl: (p.linkedinUrl ?? "").trim() || null,
      resumoProfissional: (p.resumoProfissional ?? "").trim() || null,
      obs: (p.obs ?? "").trim() || null,
      origem: Number.isFinite(Number(p.origem)) ? Number(p.origem) : 0,
      cep: (p.cep ?? "").trim() || null,
      logradouro: (p.logradouro ?? "").trim() || null,
      numero: (p.numero ?? "").trim() || null,
      bairro: (p.bairro ?? "").trim() || null,
      complemento: (p.complemento ?? "").trim() || null,
      cpf: (p.cpf ?? "").trim() || null,
      rg: (p.rg ?? "").trim() || null,
      foneContato: (p.foneContato ?? "").trim() || null,
      dataNascimento: (p.dataNascimento ?? "").trim() || null,
    };
  }

  async function save() {
    const id = (draft.id ?? "").trim();
    if (!id) return;
    const payload = buildPayload(draft);
    if (!payload.nome || !payload.email) {
      toast.error("Preencha Nome e E-mail.");
      return;
    }
    setSaving(true);
    try {
      await fetchJson(`/api/pessoas/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Pessoa atualizada.");
      setEditOpen(false);
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function openBlock(item: PessoaListItem) {
    setBlockTarget(item);
    setBlockMotivo("");
    setBlockOpen(true);
  }

  async function confirmBlock() {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      const motivo = blockMotivo.trim() || null;
      await fetchJson(`/api/bloqueio-pessoa/block/${encodeURIComponent(blockTarget.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      toast.success("Pessoa bloqueada.");
      setBlockOpen(false);
      setBlockTarget(null);
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao bloquear.");
    } finally {
      setBlocking(false);
    }
  }

  async function unblock(item: PessoaListItem) {
    const bloqueioId = (item.bloqueioId ?? "").trim();
    if (!bloqueioId) return;
    if (!(await confirmDialog({ title: "Desbloquear pessoa", description: `Desbloquear "${item.nome ?? ""}"?`, confirmText: "Desbloquear" }))) return;
    try {
      await fetchJson(`/api/bloqueio-pessoa/${encodeURIComponent(bloqueioId)}`, { method: "DELETE" });
      toast.success("Pessoa desbloqueada.");
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desbloquear.");
    }
  }

  function openManualBlock() {
    setManualNome("");
    setManualEmail("");
    setManualMotivo("");
    setManualOpen(true);
  }

  async function confirmManualBlock() {
    const nome = manualNome.trim();
    const email = manualEmail.trim();
    const motivo = manualMotivo.trim() || null;
    if (!nome || !email) {
      toast.error("Preencha Nome e E-mail.");
      return;
    }
    setManualSaving(true);
    try {
      await fetchJson(`/api/bloqueio-pessoa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, motivo }),
      });
      toast.success("Pessoa bloqueada.");
      setManualOpen(false);
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao bloquear pessoa.");
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Pessoas</h4>
          <div className="text-muted-foreground text-sm">Blacklist • Cadastro • Histórico</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              syncList()
                .catch(() => toast.error("Falha ao atualizar."))
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCw className="mr-1 size-4" />
            Atualizar
          </Button>
          <Button size="sm" onClick={openManualBlock}>
            <UserX className="mr-1 size-4" />
            Bloquear pessoa
          </Button>
        </div>
      </div>

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Lista de pessoas</div>
            <div className="text-muted-foreground text-sm">Busque por nome ou e-mail. Bloqueie/Desbloqueie pela lista.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-[260px] pl-8"
                placeholder="nome, email..."
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Fone</TableHead>
              <TableHead>Cidade / UF</TableHead>
              <TableHead>Bloqueado</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : items.length ? (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.nome ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.fone ?? "—"}</TableCell>
                  <TableCell className="text-sm">{[p.cidade, p.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
                  <TableCell>{blockedBadge(!!p.estaBloqueado)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(p.createdAtUtc)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="icon-xs" title="Editar" onClick={() => void openEdit(p.id)}>
                        <Pencil />
                      </Button>
                      {p.estaBloqueado ? (
                        <Button
                          variant="outline"
                          size="icon-xs"
                          title="Desbloquear"
                          onClick={() => void unblock(p)}
                        >
                          <Unlock />
                        </Button>
                      ) : (
                        <Button variant="outline" size="icon-xs" title="Bloquear" onClick={() => openBlock(p)}>
                          <UserX />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma pessoa encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Exibir</span>
            <select
              className="h-8 rounded border bg-transparent px-2 text-xs"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 20)}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>por página</span>
            <span className="ml-2">
              Total: <span className="font-mono">{totalCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="px-2 text-xs font-mono">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────── Edit Dialog ───────────────────────────── */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setTab("dados");
            setDraft({ ...emptyPessoa });
            setHistoryItems([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draft?.nome ? `Editar — ${draft.nome}` : "Editar pessoa"}</DialogTitle>
            <DialogDescription>Dados básicos, endereço, documentos e histórico.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { k: "dados", label: "Dados básicos" },
                { k: "endereco", label: "Endereço" },
                { k: "docs", label: "Documentos" },
                { k: "historico", label: "Histórico" },
              ] as const
            ).map((t) => (
              <Button
                key={t.k}
                type="button"
                size="sm"
                variant={tab === t.k ? "default" : "outline"}
                onClick={() => setTab(t.k)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {tab === "dados" ? (
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label>
                <Input value={draft.nome ?? ""} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail *</label>
                <Input
                  type="email"
                  value={draft.email ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label>
                <Input value={draft.fone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, fone: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cidade</label>
                <Input value={draft.cidade ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cidade: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">UF</label>
                <Input value={draft.uf ?? ""} onChange={(e) => setDraft((d) => ({ ...d, uf: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Origem</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={String(draft.origem ?? 0)}
                  onChange={(e) => setDraft((d) => ({ ...d, origem: Number(e.target.value) || 0 }))}
                >
                  {ORIGEM_PESSOA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-12">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">LinkedIn</label>
                <Input
                  placeholder="https://linkedin.com/in/..."
                  value={draft.linkedinUrl ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, linkedinUrl: e.target.value }))}
                />
              </div>
              <div className="md:col-span-12">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Resumo profissional</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={draft.resumoProfissional ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, resumoProfissional: e.target.value }))}
                />
              </div>
              <div className="md:col-span-12">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={draft.obs ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, obs: e.target.value }))}
                />
              </div>
            </div>
          ) : null}

          {tab === "endereco" ? (
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">CEP</label>
                <Input value={draft.cep ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Logradouro</label>
                <Input
                  value={draft.logradouro ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, logradouro: e.target.value }))}
                />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Número</label>
                <Input
                  value={draft.numero ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, numero: e.target.value }))}
                />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Bairro</label>
                <Input value={draft.bairro ?? ""} onChange={(e) => setDraft((d) => ({ ...d, bairro: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Complemento</label>
                <Input
                  value={draft.complemento ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, complemento: e.target.value }))}
                />
              </div>
            </div>
          ) : null}

          {tab === "docs" ? (
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">CPF</label>
                <Input value={draft.cpf ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cpf: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">RG</label>
                <Input value={draft.rg ?? ""} onChange={(e) => setDraft((d) => ({ ...d, rg: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone de contato</label>
                <Input
                  value={draft.foneContato ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, foneContato: e.target.value }))}
                />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Data de nascimento</label>
                <Input
                  placeholder="YYYY-MM-DD"
                  value={draft.dataNascimento ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, dataNascimento: e.target.value }))}
                />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Criado em</label>
                <Input readOnly value={draft.createdAtUtc ? fmtDate(draft.createdAtUtc) : "—"} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Atualizado em</label>
                <Input readOnly value={draft.updatedAtUtc ? fmtDate(draft.updatedAtUtc) : "—"} />
              </div>
            </div>
          ) : null}

          {tab === "historico" ? (
            <div className="mt-2">
              {historyLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Carregando histórico…</div>
              ) : historyItems.length ? (
                <div className="space-y-2">
                  {historyItems.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-xl border border-border/40 bg-card/50 p-3 text-sm"
                      style={{ boxShadow: "none" }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          {fmtDateTime(h.occurredAt)} — {stateLabel(h.state)}
                          {h.changedColumns ? <span className="text-muted-foreground"> ({h.changedColumns})</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{h.userName ? `por ${h.userName}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────── Bloquear (motivo) Dialog ───────────────────────────── */}
      <Dialog
        open={blockOpen}
        onOpenChange={(open) => {
          setBlockOpen(open);
          if (!open) {
            setBlockTarget(null);
            setBlockMotivo("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{blockTarget?.nome ? `Bloquear — ${blockTarget.nome}` : "Bloquear pessoa"}</DialogTitle>
            <DialogDescription>Informe o motivo do bloqueio (opcional).</DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Motivo</label>
            <textarea className="form-control" rows={3} value={blockMotivo} onChange={(e) => setBlockMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)} disabled={blocking}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmBlock()} disabled={blocking}>
              {blocking ? "Bloqueando…" : "Bloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────── Bloqueio manual Dialog ───────────────────────────── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bloquear pessoa</DialogTitle>
            <DialogDescription>Informe nome e e-mail. Opcionalmente informe o motivo.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label>
              <Input value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail *</label>
              <Input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Motivo</label>
              <textarea
                className="form-control"
                rows={2}
                value={manualMotivo}
                onChange={(e) => setManualMotivo(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)} disabled={manualSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmManualBlock()} disabled={manualSaving}>
              {manualSaving ? "Bloqueando…" : "Bloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

