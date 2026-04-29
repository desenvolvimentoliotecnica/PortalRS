"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, RefreshCw, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { lookupCep } from "@/lib/cepLookup";
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

function fmtPhoneBr(phone: string | null | undefined) {
  const raw = (phone ?? "").trim();
  if (!raw) return "—";

  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return raw;
}

function stateLabel(state: string | null | undefined) {
  const s = (state ?? "").toLowerCase();
  if (s === "added") return "Criado";
  if (s === "modified") return "Alterado";
  if (s === "deleted") return "Removido";
  return state || "—";
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
  const [sort, setSort] = useState("nome");
  const [dir, setDir] = useState("asc");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("dados");
  const [draft, setDraft] = useState<PessoaResponse>({ ...emptyPessoa });

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<EntityChangeListItem[]>([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))), [totalCount, pageSize]);

  const syncList = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));
    const qq = q.trim();
    if (qq) qs.set("q", qq);
    qs.set("sort", sort);
    qs.set("dir", dir);

    const payload = await fetchJson<PessoasPagedResponse>(`/api/pessoas?${qs.toString()}`);
    const list = Array.isArray(payload?.items) ? payload.items : [];

    setItems(list);
    setTotalCount(Number(payload?.totalCount ?? list.length) || 0);

    const nextPage = Number(payload?.page ?? page) || page;
    const nextPageSize = Number(payload?.pageSize ?? pageSize) || pageSize;
    if (nextPage !== page) setPage(nextPage);
    if (nextPageSize !== pageSize) setPageSize(nextPageSize);
  }, [page, pageSize, q, sort, dir]);

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
      // API serializa o enum como string ("Funcionario", "Manual"…) via JsonStringEnumConverter.
      // Em alguns lugares vem como número (legado). Suporta ambos pra manter origem correto.
      origem: typeof p.origem === "number"
        ? p.origem
        : ({ Manual: 0, Talento: 1, Vaga: 2, Email: 3, Site: 4, Candidatura: 5, Pasta: 6, Funcionario: 7, Outro: 8 } as Record<string, number>)[String(p.origem ?? "")] ?? 0,
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

  async function deletePessoa(item: PessoaListItem) {
    if (!(await confirmDialog({
      title: "Excluir pessoa",
      description: `Excluir permanentemente "${item.nome ?? item.email ?? ""}"? Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
    }))) return;
    try {
      await fetchJson(`/api/pessoas/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      toast.success("Pessoa excluída.");
      await syncList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir pessoa.");
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
              {(() => {
                const sh = (col: string, label: string) => {
                  const active = sort === col;
                  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                  return (
                    <TableHead key={col} className="cursor-pointer select-none whitespace-nowrap" onClick={() => { const nd = active && dir === "asc" ? "desc" : "asc"; setSort(col); setDir(nd); }}>
                      <span className="inline-flex items-center gap-1">{label}<Icon className={`size-3 ${active ? "" : "opacity-30"}`} /></span>
                    </TableHead>
                  );
                };
                return (<>
                  {sh("nome", "Nome")}
                  {sh("email", "E-mail")}
                  {sh("fone", "Fone")}
                  {sh("cidade", "Cidade / UF")}
                  {sh("criado", "Criado em")}
                </>);
              })()}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : items.length ? (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.nome ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{fmtPhoneBr(p.fone)}</TableCell>
                  <TableCell className="text-sm">{[p.cidade, p.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
                  <TableCell className="text-sm">{fmtDate(p.createdAtUtc)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="icon-xs" title="Editar" onClick={() => void openEdit(p.id)}>
                        <Pencil />
                      </Button>
                      {/* Pessoas com origem=Funcionario vieram do sync TOTVS RM — read-only.
                          API serializa o enum como string ("Funcionario") via JsonStringEnumConverter,
                          mas em alguns endpoints retorna como número (7). Compara ambos. */}
                      {(p.origem !== 7 && String(p.origem) !== "Funcionario") && (
                        <Button
                          variant="outline"
                          size="icon-xs"
                          title="Excluir"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => void deletePessoa(p)}
                        >
                          <Trash2 />
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
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                  className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  rows={2}
                  value={draft.resumoProfissional ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, resumoProfissional: e.target.value }))}
                />
              </div>
              <div className="md:col-span-12">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label>
                <textarea
                  className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
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
                <Input
                  value={draft.cep ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))}
                  onBlur={async () => {
                    // Sessão 31.8 — auto-preenche endereço via ViaCEP
                    const res = await lookupCep(draft.cep ?? "");
                    if (!res) return;
                    setDraft((d) => ({
                      ...d,
                      logradouro: (d.logradouro ?? "").trim() || res.logradouro,
                      bairro: (d.bairro ?? "").trim() || res.bairro,
                      cidade: (d.cidade ?? "").trim() || res.cidade,
                      uf: (d.uf ?? "").trim() || res.uf,
                    }));
                    toast.success("Endereço preenchido a partir do CEP");
                  }}
                  title="Sair do campo (Tab) busca o endereço automaticamente"
                />
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

    </section>
  );
}

