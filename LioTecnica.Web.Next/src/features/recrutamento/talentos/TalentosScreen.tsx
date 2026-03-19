"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, FileUp, Loader2, Plus, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import PaginationBar from "@/components/pagination/PaginationBar";

const BASE = "/app";

/* ─── Types ─── */

type TalentItem = {
  id: string;
  nome?: string | null;
  cpf?: string | null;
  email?: string | null;
  fone?: string | null;
  cidade?: string | null;
  uf?: string | null;
  origem?: string | null;
  cvImportStatus?: string | number | null;
  createdAtUtc?: string | null;
};

type Paged = { items: TalentItem[]; totalCount: number; page: number; pageSize: number };
type VagaOption = { id: string; label: string };

/* ─── Helpers ─── */

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : v == null ? fb : String(v);
}

function num(v: unknown, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapPaged(raw: unknown): Paged {
  const r = asRec(raw) ?? {};
  const arr = Array.isArray(r.items) ? (r.items as unknown[]) : [];
  return {
    items: arr
      .map((x) => {
        const it = asRec(x);
        if (!it) return null;
        const id = str(it.id, "");
        if (!id) return null;
        return {
          id,
          nome: str(it.nome, "") || null,
          cpf: str(it.cpf, "") || null,
          email: str(it.email, "") || null,
          fone: str(it.fone, "") || null,
          cidade: str(it.cidade, "") || null,
          uf: str(it.uf, "") || null,
          origem: str(it.origem, "") || null,
          cvImportStatus: typeof it.cvImportStatus === "string" || typeof it.cvImportStatus === "number"
            ? it.cvImportStatus
            : null,
          createdAtUtc: str(it.createdAtUtc, "") || null,
        } satisfies TalentItem;
      })
      .filter(Boolean) as TalentItem[],
    totalCount: num(r.totalCount, 0),
    page: Math.max(1, num(r.page, 1)),
    pageSize: Math.max(1, num(r.pageSize, 20)),
  };
}

function mapVagas(raw: unknown): VagaOption[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(asRec(raw)?.items)
      ? (asRec(raw)!.items as unknown[])
      : [];
  return arr
    .map((x) => {
      const r = asRec(x) ?? {};
      const id = str(r.id, "");
      if (!id) return null;
      const titulo = str(r.titulo, "Sem título");
      const codigo = str(r.codigo, "");
      return { id, label: codigo ? `${titulo} (${codigo})` : titulo };
    })
    .filter(Boolean) as VagaOption[];
}

function cvStatusLabel(s: unknown): string {
  if (s == null) return "—";
  const map: Record<string, string> = {
    "0": "Pendente", Pendente: "Pendente",
    "1": "Processando", EmProcessamento: "Processando",
    "2": "Pendente validação", PendenteValidacao: "Pendente validação",
    "3": "Concluído", Concluido: "Concluído",
  };
  return map[String(s)] ?? String(s);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function origemBadge(o: string | null | undefined) {
  const map: Record<string, string> = {
    Email: "bg-blue-100 text-blue-700",
    Site: "bg-purple-100 text-purple-700",
    Candidatura: "bg-indigo-100 text-indigo-700",
    Pasta: "bg-amber-100 text-amber-700",
    Manual: "bg-slate-100 text-slate-600",
  };
  const key = str(o, "Manual");
  return { label: key || "Manual", cls: map[key] ?? "bg-slate-100 text-slate-600" };
}

/* ─── Component ─── */

export default function TalentosScreen() {
  const [items, setItems] = useState<TalentItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [origem, setOrigem] = useState("");
  const [vagas, setVagas] = useState<VagaOption[]>([]);

  // Modais
  const [newOpen, setNewOpen] = useState(false);
  const [newDraft, setNewDraft] = useState({ nome: "", email: "", fone: "", cidade: "", uf: "", origem: "Manual", cpf: "", linkedin: "", resumoProfissional: "" });
  const [newSaving, setNewSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importGpt, setImportGpt] = useState(true);
  const [importLoading, setImportLoading] = useState(false);

  const [cadOpen, setCadOpen] = useState(false);
  const [cadTalentoId, setCadTalentoId] = useState("");
  const [cadTalentoNome, setCadTalentoNome] = useState("");
  const [cadVagaId, setCadVagaId] = useState("");
  const [cadSaving, setCadSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ─── Load on mount ─── */
  useEffect(() => {
    void load(1, 20, "", "");
    void loadVagas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadVagas() {
    try {
      const data = await fetchJson<unknown>(`${BASE}/api/vagas`);
      setVagas(mapVagas(data));
    } catch { /* best effort */ }
  }

  async function load(p: number, ps: number, qStr: string, orig: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(ps) });
      if (qStr.trim()) params.set("q", qStr.trim());
      if (orig) params.set("origem", orig);
      const data = await fetchJson<unknown>(`${BASE}/api/talentos?${params.toString()}`);
      const mapped = mapPaged(data);
      setItems(mapped.items);
      setTotalCount(mapped.totalCount);
      setPage(mapped.page);
      setPageSize(mapped.pageSize);
    } catch {
      toast.error("Falha ao carregar talentos.");
    } finally {
      setLoading(false);
    }
  }

  /* ─── Ações ─── */

  async function handleSearch() {
    await load(1, pageSize, q, origem);
  }

  async function handleDelete(id: string, nome?: string | null) {
    const ok = await confirmDialog({
      title: "Eliminar talento",
      description: `Eliminar o talento "${nome ?? ""}"? A pessoa vinculada não é removida.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetchJson(`${BASE}/api/talentos/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Talento eliminado.");
      await load(page, pageSize, q, origem);
    } catch { toast.error("Falha ao eliminar."); }
  }

  async function handleSaveNew() {
    if (!newDraft.nome.trim()) { toast.error("Nome é obrigatório."); return; }
    if (!newDraft.email.trim()) { toast.error("E-mail é obrigatório."); return; }
    setNewSaving(true);
    try {
      await fetchJson(`${BASE}/api/talentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDraft),
      });
      toast.success("Talento cadastrado.");
      setNewOpen(false);
      setNewDraft({ nome: "", email: "", fone: "", cidade: "", uf: "", origem: "Manual", cpf: "", linkedin: "", resumoProfissional: "" });
      await load(1, pageSize, q, origem);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally { setNewSaving(false); }
  }

  async function handleImportPdf() {
    if (!importFile) { toast.error("Selecione um arquivo PDF."); return; }
    setImportLoading(true);
    try {
      const form = new FormData();
      form.append("arquivo", importFile);
      form.append("enviarParaGpt", importGpt ? "true" : "false");
      const resp = await fetchJson<unknown>(`${BASE}/api/talentos/import-pdf`, { method: "POST", body: form });
      const r = asRec(resp) ?? {};
      toast.success(str(r.jobId, "") ? `Importação iniciada (job ${str(r.jobId, "")}).` : "Importação concluída.");
      setImportOpen(false);
      setImportFile(null);
      await load(1, pageSize, q, origem);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar PDF.");
    } finally { setImportLoading(false); }
  }

  async function openCadastrarCandidato(t: TalentItem) {
    setCadTalentoId(t.id);
    setCadTalentoNome(str(t.nome, "Talento"));
    setCadVagaId(vagas[0]?.id ?? "");
    if (!vagas.length) await loadVagas();
    setCadOpen(true);
  }

  async function handleCadastrarCandidato() {
    if (!cadVagaId) { toast.error("Selecione uma vaga."); return; }
    setCadSaving(true);
    try {
      const tal = await fetchJson<unknown>(`${BASE}/api/talentos/${encodeURIComponent(cadTalentoId)}`);
      const t = asRec(tal) ?? {};
      await fetchJson(`${BASE}/api/candidatos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: str(t.nome, ""),
          email: str(t.email, ""),
          fone: str(t.fone, "") || null,
          cidade: str(t.cidade, "") || null,
          uf: str(t.uf, "").toUpperCase().slice(0, 2) || null,
          fonte: "Talentos",
          status: "Triagem",
          vagaId: cadVagaId,
          obs: null,
          cvText: str(t.cvText, "") || null,
          lastMatch: null,
          documentos: null,
          talentoId: cadTalentoId,
        }),
      });
      toast.success(`"${cadTalentoNome}" cadastrado como candidato.`);
      setCadOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar candidato.");
    } finally { setCadSaving(false); }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetailData(null);
    try {
      const data = await fetchJson<unknown>(`${BASE}/api/talentos/${encodeURIComponent(id)}`);
      setDetailData(asRec(data));
    } catch { toast.error("Falha ao carregar detalhes."); }
    finally { setDetailLoading(false); }
  }

  /* ─── Render ─── */

  const emptyFilter = useMemo(() => !loading && items.length === 0, [loading, items]);

  return (
    <section className="space-y-6">

      {/* Header + fluxo */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Banco de Talentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Pessoas cadastradas que ainda não são candidatos de uma vaga específica.
          </p>
          {/* Fluxo visual */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 px-2.5 py-1 font-semibold">
              <Users className="size-3" /> Talentos
            </span>
            <ArrowRight className="size-3 opacity-40" />
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2.5 py-1 font-semibold">
              <UserCheck className="size-3" /> Candidatos
            </span>
            <ArrowRight className="size-3 opacity-40" />
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 font-semibold">
              Triagem
            </span>
            <ArrowRight className="size-3 opacity-40" />
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 font-semibold">
              Matching
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(page, pageSize, q, origem)}>
            <RefreshCw className="size-4" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <FileUp className="size-4" /> Importar PDF
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> Novo talento
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, e-mail, CPF…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring w-[160px]"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
          >
            <option value="">Todas as origens</option>
            <option value="Email">Email</option>
            <option value="Site">Site</option>
            <option value="Candidatura">Candidatura</option>
            <option value="Pasta">Pasta</option>
            <option value="Manual">Manual</option>
          </select>
          <Button size="sm" onClick={() => void handleSearch()}>Filtrar</Button>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">E-mail</TableHead>
                <TableHead className="hidden lg:table-cell">Cidade / UF</TableHead>
                <TableHead className="hidden lg:table-cell">Origem</TableHead>
                <TableHead className="hidden xl:table-cell">Status CV</TableHead>
                <TableHead className="hidden xl:table-cell">Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-6 animate-spin opacity-40" />
                      <p className="text-sm">Carregando talentos…</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {emptyFilter && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="size-10 opacity-20" />
                      <p className="text-sm font-medium">Nenhum talento encontrado</p>
                      <p className="text-xs opacity-60">Cadastre manualmente ou importe um currículo em PDF.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && items.map((t) => {
                const badge = origemBadge(t.origem);
                const cidadeUf = [t.cidade, t.uf].filter(Boolean).join(" / ") || "—";
                return (
                  <TableRow key={t.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium text-sm">{t.nome ?? "—"}</div>
                      {t.cpf && <div className="text-xs text-muted-foreground font-mono">{t.cpf}</div>}
                      <div className="text-xs text-muted-foreground md:hidden">{t.email ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{t.email ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{cidadeUf}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">
                      {cvStatusLabel(t.cvImportStatus)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">
                      {fmtDate(t.createdAtUtc)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => void openCadastrarCandidato(t)}
                          title="Cadastrar como candidato em uma vaga"
                        >
                          <UserCheck className="mr-1 size-4" /> Candidatar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void openDetail(t.id)}>
                          Detalhes
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleDelete(t.id, t.nome)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={(p) => { setPage(p); void load(p, pageSize, q, origem); }}
          onPageSizeChange={(ps) => { setPageSize(ps || 20); void load(1, ps || 20, q, origem); }}
        />
      </div>

      {/* ─── Modal: Novo Talento ─── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo talento</DialogTitle>
            <DialogDescription>
              Cadastro manual na base de talentos. Depois você pode candidatá-lo a uma vaga específica.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
              <Input value={newDraft.nome} onChange={(e) => setNewDraft({ ...newDraft, nome: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail *</label>
              <Input type="email" value={newDraft.email} onChange={(e) => setNewDraft({ ...newDraft, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
              <Input value={newDraft.fone} onChange={(e) => setNewDraft({ ...newDraft, fone: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CPF</label>
              <Input value={newDraft.cpf} onChange={(e) => setNewDraft({ ...newDraft, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cidade</label>
              <Input value={newDraft.cidade} onChange={(e) => setNewDraft({ ...newDraft, cidade: e.target.value })} placeholder="São Paulo" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">UF</label>
              <Input maxLength={2} value={newDraft.uf} onChange={(e) => setNewDraft({ ...newDraft, uf: e.target.value.toUpperCase() })} placeholder="SP" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">LinkedIn</label>
              <Input value={newDraft.linkedin} onChange={(e) => setNewDraft({ ...newDraft, linkedin: e.target.value })} placeholder="linkedin.com/in/..." />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Origem</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={newDraft.origem}
                onChange={(e) => setNewDraft({ ...newDraft, origem: e.target.value })}
              >
                <option value="Manual">Manual</option>
                <option value="Email">Email</option>
                <option value="Site">Site</option>
                <option value="Candidatura">Candidatura</option>
                <option value="Pasta">Pasta</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Resumo profissional</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
                value={newDraft.resumoProfissional}
                onChange={(e) => setNewDraft({ ...newDraft, resumoProfissional: e.target.value })}
                placeholder="Experiência, habilidades principais…"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button disabled={newSaving} onClick={() => void handleSaveNew()}>
              {newSaving && <Loader2 className="size-4 animate-spin mr-1" />} Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Importar PDF ─── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Importar currículo (PDF)</DialogTitle>
            <DialogDescription>
              O sistema extrai os dados automaticamente com IA e cria o talento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <input
              type="file"
              accept="application/pdf"
              className="w-full text-sm"
              onChange={(e) => setImportFile(e.currentTarget.files?.[0] ?? null)}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={importGpt} onChange={(e) => setImportGpt(e.target.checked)} />
              Usar IA (GPT) para extrair dados do currículo
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button disabled={importLoading || !importFile} onClick={() => void handleImportPdf()}>
              {importLoading && <Loader2 className="size-4 animate-spin mr-1" />} Importar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Cadastrar como candidato ─── */}
      <Dialog open={cadOpen} onOpenChange={setCadOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Candidatar à vaga</DialogTitle>
            <DialogDescription>
              <strong>{cadTalentoNome}</strong> será cadastrado como candidato na vaga selecionada e entrará na triagem.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selecione a vaga *</label>
              {vagas.length === 0 ? (
                <p className="text-sm text-amber-600">Nenhuma vaga aberta encontrada. Crie uma vaga primeiro.</p>
              ) : (
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={cadVagaId}
                  onChange={(e) => setCadVagaId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              )}
            </div>
            {/* Fluxo reminder */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
              Após candidatar, o talento aparece em <strong>Candidatos</strong> com status <strong>Triagem</strong>. Acesse Triagem ou Matching para avançar no processo.
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setCadOpen(false)}>Cancelar</Button>
            <Button
              disabled={cadSaving || !cadVagaId}
              onClick={() => void handleCadastrarCandidato()}
            >
              {cadSaving && <Loader2 className="size-4 animate-spin mr-1" />}
              <UserCheck className="size-4 mr-1" /> Candidatar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Detalhes do talento ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do talento</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : detailData ? (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {(["nome", "email", "cpf", "fone", "cidade", "uf", "origem", "linkedinUrl"] as const).map((k) => {
                  const v = str(detailData[k], "");
                  if (!v) return null;
                  return (
                    <div key={k}>
                      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{k}</div>
                      <div className="font-medium">{v}</div>
                    </div>
                  );
                })}
              </div>
              {str(detailData.resumoProfissional, "") && (
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Resumo profissional</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{str(detailData.resumoProfissional, "")}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4">Sem dados.</p>
          )}
          <div className="flex justify-end mt-2">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
