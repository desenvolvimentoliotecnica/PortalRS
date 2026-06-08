"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Award, Briefcase, Check, Download, Eye, FileText, FileUp, GraduationCap, Linkedin, Loader2, Mail, MapPin, Phone, Plus, RefreshCw, Search, Sparkles, UserCheck, Users, UserX } from "lucide-react";
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
  cvImportJobId?: string | null;
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
          cvImportJobId: str(it.cvImportJobId, "") || null,
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

function isPendenteValidacao(s: unknown): boolean {
  if (s == null) return false;
  const v = String(s);
  return v === "2" || v === "PendenteValidacao";
}

function cvStatusBadgeClass(s: unknown): string {
  const v = String(s ?? "");
  if (v === "2" || v === "PendenteValidacao") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (v === "1" || v === "EmProcessamento") return "bg-blue-100 text-blue-700 ring-blue-200";
  if (v === "3" || v === "Concluido") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (v === "0" || v === "Pendente") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-slate-50 text-slate-500 ring-slate-200";
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch { return iso; }
}

function formatBytes(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function isPdfDocument(nomeArquivo: string, contentType?: string | null): boolean {
  return contentType?.toLowerCase().includes("pdf") === true || nomeArquivo.toLowerCase().endsWith(".pdf");
}

function readApiMessage(raw: string, fallback: string) {
  if (!raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string; detail?: string; title?: string };
    return parsed.message || parsed.detail || parsed.title || fallback;
  } catch {
    return raw;
  }
}

async function downloadArquivo(path: string, suggestedName: string): Promise<void> {
  const res = await apiFetch(path, { method: "GET", headers: { Accept: "*/*" } }, 120_000);
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(raw?.trim() || `Falha ao baixar arquivo (${res.status}).`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = suggestedName.trim() || "curriculo";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
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

  const [valOpen, setValOpen] = useState(false);
  const [valLoading, setValLoading] = useState(false);
  const [valSaving, setValSaving] = useState(false);
  const [valData, setValData] = useState<Record<string, unknown> | null>(null);
  const [valJobId, setValJobId] = useState<string>("");

  /* ─── Load on mount ─── */
  useEffect(() => {
    void load(1, 20, "", "");
    void loadVagas();
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

  function openValidacao(jobId: string) {
    setValJobId(jobId);
    setValOpen(true);
    setValData(null);
    setValLoading(true);
    void (async () => {
      try {
        const data = await fetchJson<unknown>(`${BASE}/api/talentos/import-jobs/${encodeURIComponent(jobId)}`);
        setValData(asRec(data));
      } catch { toast.error("Falha ao carregar validação."); setValOpen(false); }
      finally { setValLoading(false); }
    })();
  }

  async function aprovarValidacao() {
    if (!valJobId) return;
    setValSaving(true);
    try {
      await fetchJson<unknown>(`${BASE}/api/talentos/import-jobs/${encodeURIComponent(valJobId)}/aprovar`, { method: "POST" });
      toast.success("Cadastro existente atualizado com os dados do CV.");
      setValOpen(false);
      await load(page, pageSize, q, origem);
    } catch { toast.error("Falha ao aprovar."); }
    finally { setValSaving(false); }
  }

  async function recusarValidacao() {
    if (!valJobId) return;
    setValSaving(true);
    try {
      await fetchJson<unknown>(`${BASE}/api/talentos/import-jobs/${encodeURIComponent(valJobId)}/recusar`, { method: "POST" });
      toast.success("Mantidos como talentos separados.");
      setValOpen(false);
      await load(page, pageSize, q, origem);
    } catch { toast.error("Falha ao recusar."); }
    finally { setValSaving(false); }
  }

  /* ─── Render ─── */

  const emptyFilter = useMemo(() => !loading && items.length === 0, [loading, items]);

  return (
    <section className="space-y-5">

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

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total</div>
          <div className="text-2xl font-bold mt-1.5 tabular-nums">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 shadow-sm p-4">
          <div className="text-[10px] font-semibold text-blue-600/70 uppercase tracking-widest">Email</div>
          <div className="text-2xl font-bold mt-1.5 text-blue-600 tabular-nums">{items.filter(t => (t.origem ?? "").toLowerCase() === "email").length}</div>
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 shadow-sm p-4">
          <div className="text-[10px] font-semibold text-purple-600/70 uppercase tracking-widest">Site / Candidatura</div>
          <div className="text-2xl font-bold mt-1.5 text-purple-600 tabular-nums">{items.filter(t => ["site", "candidatura"].includes((t.origem ?? "").toLowerCase())).length}</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 shadow-sm p-4">
          <div className="text-[10px] font-semibold text-amber-600/70 uppercase tracking-widest">Manual / Pasta</div>
          <div className="text-2xl font-bold mt-1.5 text-amber-600 tabular-nums">{items.filter(t => ["manual", "pasta"].includes((t.origem ?? "").toLowerCase())).length}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
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
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {t.cvImportStatus != null ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cvStatusBadgeClass(t.cvImportStatus)}`}>
                          {cvStatusLabel(t.cvImportStatus)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">
                      {fmtDate(t.createdAtUtc)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {isPendenteValidacao(t.cvImportStatus) && t.cvImportJobId && (
                          <Button
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => openValidacao(t.cvImportJobId!)}
                            title="Revisar duplicidade detectada"
                          >
                            <AlertTriangle className="mr-1 size-4" /> Validar
                          </Button>
                        )}
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
        <DialogContent className="!max-w-[min(1280px,95vw)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do talento</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : detailData ? (
            <TalentoDetailView data={detailData} />
          ) : (
            <p className="text-muted-foreground text-sm py-4">Sem dados.</p>
          )}
          <div className="flex justify-end mt-2 sticky bottom-0 bg-background pt-2">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Validar duplicidade ─── */}
      <Dialog open={valOpen} onOpenChange={(o) => { if (!valSaving) setValOpen(o); }}>
        <DialogContent className="!max-w-[min(1280px,95vw)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              Validar duplicidade de talento
            </DialogTitle>
            <DialogDescription>
              O CV importado parece ser de uma pessoa <strong>já cadastrada</strong>. Compare os dados e decida se é a mesma pessoa (mesclar) ou outra (manter separados).
            </DialogDescription>
          </DialogHeader>
          {valLoading ? (
            <div className="py-10 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : valData ? (
            <ValidacaoCompareView data={valData} />
          ) : (
            <p className="text-muted-foreground text-sm py-4">Sem dados.</p>
          )}
          <div className="flex flex-wrap justify-end items-center gap-2 mt-3 sticky bottom-0 bg-background pt-3 border-t">
            <Button variant="outline" onClick={() => setValOpen(false)} disabled={valSaving}>Fechar</Button>
            <Button variant="outline" onClick={() => void recusarValidacao()} disabled={valSaving} className="text-slate-700">
              <UserX className="mr-1 size-4" /> Outra pessoa (manter ambos)
            </Button>
            <Button onClick={() => void aprovarValidacao()} disabled={valSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {valSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Check className="mr-1 size-4" />}
              Mesma pessoa (mesclar)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ─── Modal sub-component: rich talento detail ─── */

function asArr(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asRec(x)).filter(Boolean) as Record<string, unknown>[];
}

function periodo(inicio?: string | null, fim?: string | null): string {
  const i = (inicio ?? "").trim();
  const f = (fim ?? "").trim();
  if (!i && !f) return "";
  if (i && f) return `${i} — ${f}`;
  if (i) return `${i} — atual`;
  return `até ${f}`;
}

function TalentoDetailView({ data }: { data: Record<string, unknown> }) {
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [previewingDocId, setPreviewingDocId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; nomeArquivo: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailFiles, setEmailFiles] = useState<File[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentInfo, setEmailSentInfo] = useState<{ subject: string; attachments: number; sentAt: string } | null>(null);
  const nome = str(data.nome, "—");
  const email = str(data.email, "");
  const fone = str(data.fone, "");
  const cidade = str(data.cidade, "");
  const uf = str(data.uf, "");
  const linkedin = str(data.linkedinUrl, "");
  const cpf = str(data.cpf, "");
  const cep = str(data.cep, "");
  const logradouro = str(data.logradouro, "");
  const numero = str(data.numero, "");
  const bairro = str(data.bairro, "");
  const origem = str(data.origem, "");
  const resumo = str(data.resumoProfissional, "");
  const obs = str(data.obs, "");
  const createdAt = str(data.createdAtUtc, "");
  const updatedAt = str(data.updatedAtUtc, "");
  const versao = str(data.versao, "");

  const competencias = asArr(data.competencias);
  const experiencias = asArr(data.experiencias);
  const treinamentos = asArr(data.treinamentos);
  const formacao = asArr(data.formacao);
  const documentos = asArr(data.documentos);
  const candidaturas = asArr(data.candidaturas);
  const candidaturaDocumentos = candidaturas.flatMap((cand) =>
    asArr(cand.documentos).map((doc) => ({ cand, doc }))
  );

  const local = [cidade, uf].filter(Boolean).join(" / ");
  const endereco = [logradouro, numero, bairro].filter(Boolean).join(", ");
  const hasPerfil = Boolean(resumo || obs || competencias.length || experiencias.length || treinamentos.length || formacao.length);
  const emailFilesLabel = useMemo(() => {
    if (emailFiles.length === 0) return "Nenhum anexo selecionado";
    return `${emailFiles.length} anexo(s): ${emailFiles.map((f) => f.name).join(", ")}`;
  }, [emailFiles]);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview?.url]);

  useEffect(() => {
    setEmailSubject("Contato do RH");
    setEmailBody(`Olá ${nome && nome !== "—" ? nome : ""},\n\n`);
    setEmailFiles([]);
    setEmailSentInfo(null);
  }, [data.id, nome]);

  async function handleDownload(path: string, nomeArquivo: string, id: string) {
    setDownloadingDocId(id);
    try {
      await downloadArquivo(path, nomeArquivo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar documento.");
    } finally {
      setDownloadingDocId(null);
    }
  }

  async function handlePreviewPdf(path: string, nomeArquivo: string, id: string) {
    setPreviewingDocId(id);
    try {
      const res = await apiFetch(path, { method: "GET", headers: { Accept: "application/pdf,*/*" } }, 120_000);
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(raw?.trim() || `Falha ao abrir currículo (${res.status}).`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
      setPdfPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url: objectUrl, nomeArquivo };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir currículo.");
    } finally {
      setPreviewingDocId(null);
    }
  }

  function closePdfPreview() {
    setPdfPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function handleSendTalentEmail() {
    const subject = emailSubject.trim();
    const body = emailBody.trim();
    if (!email.trim()) {
      toast.error("Este talento não possui e-mail cadastrado.");
      return;
    }
    if (!subject || !body) {
      toast.error("Informe assunto e corpo do e-mail.");
      return;
    }

    setEmailSending(true);
    try {
      const form = new FormData();
      form.append("assunto", subject);
      form.append("corpo", body);
      for (const file of emailFiles) form.append("anexos", file);

      const res = await apiFetch(
        `${BASE}/api/talentos/${encodeURIComponent(str(data.id, ""))}/email`,
        { method: "POST", body: form },
        120_000,
      );
      const raw = await res.text().catch(() => "");
      if (!res.ok) throw new Error(readApiMessage(raw, `HTTP ${res.status}`));

      setEmailSentInfo({ subject, attachments: emailFiles.length, sentAt: new Date().toISOString() });
      setEmailFiles([]);
      toast.success("E-mail enfileirado para envio.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar e-mail.");
    } finally {
      setEmailSending(false);
    }
  }

  const compTipos = ["Idioma", "Ferramenta", "Técnica", "Comportamental"] as const;
  const compsByTipo = compTipos
    .map((tipo) => ({
      tipo,
      items: competencias.filter((c) => {
        const t = str(c.tipo, "").toLowerCase();
        if (tipo === "Idioma") return t.includes("idioma") || t.includes("language");
        if (tipo === "Ferramenta") return t.includes("ferr") || t.includes("tool");
        if (tipo === "Técnica") return t.includes("técn") || t.includes("tecn") || t.includes("tech");
        if (tipo === "Comportamental") return t.includes("comp");
        return false;
      }),
    }))
    .filter((g) => g.items.length > 0);
  const compOutras = competencias.filter(
    (c) => !compsByTipo.some((g) => g.items.includes(c))
  );

  return (
    <>
    <div className="mt-2 space-y-3">
      {/* Header card — full width, denso */}
      <div className="rounded-xl border bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold">
            {nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-base font-semibold leading-tight">{nome}</h3>
              {origem && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">{origem}</span>}
              {cpf && <span className="text-[11px] text-muted-foreground">CPF: {cpf}</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
              {email && <span className="flex items-center gap-1.5"><Mail className="size-3.5" />{email}</span>}
              {fone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" />{fone}</span>}
              {local && <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{local}</span>}
              {linkedin && (
                <a href={linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
                  <Linkedin className="size-3.5" />{linkedin.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg border bg-white/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Experiências</div>
            <div className="text-lg font-semibold tabular-nums">{experiencias.length}</div>
          </div>
          <div className="rounded-lg border bg-white/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Competências</div>
            <div className="text-lg font-semibold tabular-nums">{competencias.length}</div>
          </div>
          <div className="rounded-lg border bg-white/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Documentos</div>
            <div className="text-lg font-semibold tabular-nums">{documentos.length + candidaturaDocumentos.length}</div>
          </div>
          <div className="rounded-lg border bg-white/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Candidaturas</div>
            <div className="text-lg font-semibold tabular-nums">{candidaturas.length}</div>
          </div>
        </div>
      </div>

      {/* Layout 2 colunas: sidebar + main */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-3">
        {/* ─── Sidebar ─── */}
        <div className="space-y-3">
          <SectionCard icon={<Users className="size-3.5" />} title="Dados cadastrais" dense>
            <dl className="grid grid-cols-1 gap-2 text-[12px]">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Cadastro</dt>
                <dd>{fmtDateTime(createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Última atualização</dt>
                <dd>{fmtDateTime(updatedAt)}</dd>
              </div>
              {versao && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Versão do perfil</dt>
                  <dd>{versao}</dd>
                </div>
              )}
              {(endereco || cep) && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Endereço</dt>
                  <dd>{endereco || "—"}{cep && <span className="block text-muted-foreground">CEP {cep}</span>}</dd>
                </div>
              )}
            </dl>
          </SectionCard>

          <SectionCard icon={<FileText className="size-3.5" />} title={`Documentos do talento (${documentos.length})`} dense>
            {documentos.length > 0 ? (
              <ul className="space-y-2">
                {documentos.map((doc) => {
                  const id = str(doc.id, "");
                  const nomeArquivo = str(doc.nomeArquivo, "curriculo.pdf");
                  const contentType = str(doc.contentType, "");
                  const isPdf = isPdfDocument(nomeArquivo, contentType);
                  const size = formatBytes(doc.tamanhoBytes);
                  const path = `${BASE}/api/talentos/${encodeURIComponent(str(data.id, ""))}/documentos/${encodeURIComponent(id)}/download`;
                  return (
                    <li key={id} className="rounded-md border bg-slate-50/70 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-medium">{nomeArquivo}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {[contentType, size, fmtDate(doc.createdAtUtc as string | null)].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {isPdf && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              disabled={!id || previewingDocId === id}
                              onClick={() => void handlePreviewPdf(path, nomeArquivo, id)}
                            >
                              {previewingDocId === id ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Eye className="mr-1 size-3" />}
                              Ver Curriculum
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            disabled={!id || downloadingDocId === id}
                            onClick={() => void handleDownload(path, nomeArquivo, id)}
                          >
                            {downloadingDocId === id ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Download className="mr-1 size-3" />}
                            Baixar
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[12px] text-muted-foreground">Nenhum documento importado diretamente no banco de talentos.</p>
            )}
          </SectionCard>

          {competencias.length > 0 && (
            <SectionCard icon={<Sparkles className="size-3.5" />} title={`Competências (${competencias.length})`} dense>
              <div className="space-y-2">
                {compsByTipo.map((g) => (
                  <div key={g.tipo}>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{g.tipo}</div>
                    <div className="flex flex-wrap gap-1">
                      {g.items.map((c, idx) => {
                        const nome = str(c.nome, "");
                        const nivel = str(c.nivel, "");
                        const tone =
                          g.tipo === "Idioma" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          g.tipo === "Ferramenta" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          g.tipo === "Comportamental" ? "bg-pink-50 text-pink-700 border-pink-200" :
                          "bg-blue-50 text-blue-700 border-blue-200";
                        return (
                          <span key={idx} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${tone}`}>
                            <span className="font-medium">{nome}</span>
                            {nivel && <span className="opacity-70">· {nivel}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {compOutras.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Outras</div>
                    <div className="flex flex-wrap gap-1">
                      {compOutras.map((c, idx) => {
                        const nome = str(c.nome, "");
                        const nivel = str(c.nivel, "");
                        return (
                          <span key={idx} className="inline-flex items-center gap-1 rounded-md border bg-slate-50 text-slate-700 border-slate-200 px-1.5 py-0.5 text-[11px]">
                            <span className="font-medium">{nome}</span>
                            {nivel && <span className="opacity-70">· {nivel}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {formacao.length > 0 && (
            <SectionCard icon={<GraduationCap className="size-3.5" />} title={`Formação (${formacao.length})`} dense>
              <ul className="space-y-2">
                {formacao.map((f, idx) => {
                  const curso = str(f.curso, "");
                  const inst = str(f.instituicao, "");
                  const tipo = str(f.tipo, "");
                  const status = str(f.status, "");
                  const inicio = str(f.inicio, "");
                  const fim = str(f.fim, "");
                  const per = periodo(inicio, fim);
                  return (
                    <li key={idx} className="border-l-2 border-emerald-200 pl-2.5">
                      <div className="font-medium text-[13px] leading-snug">{curso}</div>
                      {inst && <div className="text-[12px] text-slate-600">{inst}</div>}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                        {tipo && <span className="rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5">{tipo}</span>}
                        {status && <span className="rounded bg-amber-50 text-amber-700 px-1.5 py-0.5">{status}</span>}
                        {per && <span className="tabular-nums">{per}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}

          {treinamentos.length > 0 && (
            <SectionCard icon={<Award className="size-3.5" />} title={`Cursos (${treinamentos.length})`} dense>
              <ul className="space-y-1.5">
                {treinamentos.map((t, idx) => {
                  const nome = str(t.nome, "");
                  const inst = str(t.instituicao, "");
                  const ano = str(t.ano, "");
                  const link = str(t.link, "");
                  return (
                    <li key={idx} className="text-[12px] flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug truncate">{nome}</div>
                        {inst && <div className="text-[11px] text-slate-500 truncate">{inst}</div>}
                        {link && <a href={link} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">certificado</a>}
                      </div>
                      {ano && <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{ano}</span>}
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}
        </div>

        {/* ─── Main ─── */}
        <div className="space-y-3 min-w-0">
          {resumo && (
            <SectionCard icon={<Sparkles className="size-3.5" />} title="Resumo profissional" dense>
              <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">{resumo}</p>
            </SectionCard>
          )}

          {obs && (
            <SectionCard icon={<FileText className="size-3.5" />} title="Observações internas" dense>
              <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">{obs}</p>
            </SectionCard>
          )}

          <SectionCard icon={<Mail className="size-3.5" />} title="Enviar e-mail ao talento" dense>
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-[12px] text-blue-800">
                Destinatário: <strong>{email || "e-mail não cadastrado"}</strong>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Assunto</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  maxLength={160}
                  disabled={emailSending}
                  placeholder="Assunto do e-mail"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Mensagem</label>
                <textarea
                  className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  maxLength={4000}
                  disabled={emailSending}
                  placeholder="Escreva a mensagem para o talento..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Anexos opcionais</label>
                <input
                  type="file"
                  multiple
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={emailSending}
                  onChange={(e) => setEmailFiles(Array.from(e.target.files ?? []))}
                />
                <p className="text-[11px] text-muted-foreground">{emailFilesLabel}</p>
              </div>
              {emailSentInfo && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
                  E-mail enfileirado em {fmtDateTime(emailSentInfo.sentAt)}.
                  <span className="block">Assunto: {emailSentInfo.subject}</span>
                  <span className="block">Anexos: {emailSentInfo.attachments > 0 ? `${emailSentInfo.attachments} arquivo(s)` : "nenhum"}</span>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSendTalentEmail()}
                  disabled={emailSending || !email.trim()}
                >
                  {emailSending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
                  {emailSending ? "Enviando..." : "Enviar e-mail"}
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<Download className="size-3.5" />} title={`CVs enviados pelo Portal de Vagas (${candidaturaDocumentos.length})`} dense>
            {candidaturaDocumentos.length > 0 ? (
              <div className="grid gap-2">
                {candidaturaDocumentos.map(({ cand, doc }) => {
                  const candidatoId = str(cand.id, "");
                  const docId = str(doc.id, "");
                  const nomeArquivo = str(doc.nomeArquivo, "curriculo.pdf");
                  const tipo = str(doc.tipo, "Documento");
                  const contentType = str(doc.contentType, "");
                  const isPdf = isPdfDocument(nomeArquivo, contentType);
                  const descricao = str(doc.descricao, "");
                  const size = formatBytes(doc.tamanhoBytes);
                  const temArquivo = doc.temArquivo === true || String(doc.temArquivo).toLowerCase() === "true";
                  const vagaTitulo = str(cand.vagaTitulo, "");
                  const downloadId = `${candidatoId}:${docId}`;
                  const path = `${BASE}/api/candidatos/${encodeURIComponent(candidatoId)}/documentos/${encodeURIComponent(docId)}/download`;
                  return (
                    <div key={downloadId} className="rounded-lg border bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{tipo}</span>
                            {vagaTitulo && <span className="text-[11px] text-muted-foreground">Vaga: {vagaTitulo}</span>}
                          </div>
                          <div className="mt-1 truncate text-sm font-medium">{nomeArquivo}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                            {descricao && <span>{descricao}</span>}
                            {size && <span>{size}</span>}
                            <span>{fmtDateTime(str(doc.createdAtUtc, ""))}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          {temArquivo && isPdf && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={previewingDocId === downloadId}
                              onClick={() => void handlePreviewPdf(path, nomeArquivo, downloadId)}
                            >
                              {previewingDocId === downloadId ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Eye className="mr-1 size-4" />}
                              Ver Curriculum
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!temArquivo || downloadingDocId === downloadId}
                            onClick={() => void handleDownload(path, nomeArquivo, downloadId)}
                          >
                            {downloadingDocId === downloadId ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Download className="mr-1 size-4" />}
                            {temArquivo ? "Baixar CV" : "Sem arquivo"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">Nenhum currículo de candidatura vinculado a este talento.</p>
            )}
          </SectionCard>

          {candidaturas.length > 0 && (
            <SectionCard icon={<UserCheck className="size-3.5" />} title={`Candidaturas vinculadas (${candidaturas.length})`} dense>
              <div className="grid gap-2 md:grid-cols-2">
                {candidaturas.map((cand) => (
                  <div key={str(cand.id, "")} className="rounded-lg border bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{str(cand.vagaTitulo, "Sem vaga vinculada")}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtDateTime(str(cand.createdAtUtc, ""))}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{str(cand.status, "—")}</span>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Origem: {str(cand.fonte, "—")} · Documentos: {asArr(cand.documentos).length}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {experiencias.length > 0 && (
            <SectionCard icon={<Briefcase className="size-3.5" />} title={`Experiência profissional (${experiencias.length})`} dense>
              <ol className="space-y-3 relative before:absolute before:left-[6px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-slate-200">
                {experiencias.map((exp, idx) => {
                  const empresa = str(exp.empresa, "");
                  const cargo = str(exp.cargo, "");
                  const inicio = str(exp.inicio, "");
                  const fim = str(exp.fim, "");
                  const tipo = str(exp.tipoContratacao, "");
                  const localExp = str(exp.local, "");
                  const senior = str(exp.nivelSenioridade, "");
                  const hier = str(exp.nivelHierarquico, "");
                  const ativ = str(exp.atividades, "") || str(exp.resumoAtividades, "");
                  const per = periodo(inicio, fim);
                  return (
                    <li key={idx} className="pl-5 relative">
                      <span className="absolute left-0 top-1.5 size-3 rounded-full bg-primary/20 ring-2 ring-background" />
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <h4 className="font-semibold text-[13px] leading-tight">{cargo || "Cargo não informado"}{empresa && <span className="text-slate-500 font-normal"> · {empresa}</span>}</h4>
                        {per && <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{per}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        {senior && <span className="rounded bg-blue-50 text-blue-700 px-1.5 py-0.5">{senior}</span>}
                        {hier && <span className="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5">{hier}</span>}
                        {tipo && <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5">{tipo}</span>}
                        {localExp && <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5">{localExp}</span>}
                      </div>
                      {ativ && (
                        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 whitespace-pre-wrap">{ativ}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </SectionCard>
          )}

          {!hasPerfil && documentos.length === 0 && candidaturaDocumentos.length === 0 && candidaturas.length === 0 && (
            <div className="rounded-xl border border-dashed bg-slate-50/70 p-6 text-center">
              <Users className="mx-auto size-8 text-slate-300" />
              <h4 className="mt-2 text-sm font-semibold text-slate-700">Perfil ainda incompleto</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Este talento ainda não tem resumo, experiências, competências, formação ou documentos vinculados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    {pdfPreview && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
        <div className="flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-800">Ver Curriculum</h3>
              <p className="truncate text-xs text-muted-foreground">{pdfPreview.nomeArquivo}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = pdfPreview.url;
                  a.download = pdfPreview.nomeArquivo || "curriculo.pdf";
                  a.rel = "noopener";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                <Download className="mr-1 size-4" />
                Baixar CV
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={closePdfPreview}>
                Fechar
              </Button>
            </div>
          </div>
          <iframe
            title={`Curriculum - ${pdfPreview.nomeArquivo}`}
            src={`${pdfPreview.url}#toolbar=1&navpanes=0&view=FitH`}
            className="min-h-0 flex-1 bg-slate-100"
          />
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}

function SectionCard({ icon, title, children, dense }: { icon: React.ReactNode; title: string; children: React.ReactNode; dense?: boolean }) {
  return (
    <div className="rounded-lg border bg-white">
      <div className={`flex items-center gap-1.5 border-b bg-slate-50/60 rounded-t-lg ${dense ? "px-3 py-1.5" : "px-4 py-2.5"}`}>
        <span className="text-primary">{icon}</span>
        <h3 className={`font-semibold text-slate-800 ${dense ? "text-[12px]" : "text-sm"}`}>{title}</h3>
      </div>
      <div className={dense ? "p-3" : "p-4"}>
        {children}
      </div>
    </div>
  );
}

/* ─── Validação de duplicidade — comparação side-by-side ─── */

function ValidacaoCompareView({ data }: { data: Record<string, unknown> }) {
  const existing = asRec(data.existingTalento) ?? {};
  const sugg = asRec(data.suggestedData) ?? {};

  const ePessoa = {
    nome: str(existing.nome, "—"),
    email: str(existing.email, ""),
    fone: str(existing.fone, ""),
    cidade: str(existing.cidade, ""),
    uf: str(existing.uf, ""),
    cpf: str(existing.cpf, ""),
    linkedin: str(existing.linkedinUrl, ""),
    resumo: str(existing.resumoProfissional, ""),
  };
  const sPessoa = {
    nome: str(sugg.nome, "—"),
    email: str(sugg.email, ""),
    fone: str(sugg.fone, ""),
    cidade: str(sugg.cidade, ""),
    uf: str(sugg.uf, ""),
    cpf: str(sugg.cpf, ""),
    linkedin: str(sugg.linkedinUrl, ""),
    resumo: str(sugg.resumoProfissional, ""),
  };

  const eExp = asArr(existing.experiencias);
  const sExp = asArr(sugg.experiencias);
  const eForm = asArr(existing.formacao);
  const sForm = asArr(sugg.formacao);
  const eComp = asArr(existing.competencias);
  const sComp = asArr(sugg.competencias);

  return (
    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ColuncaTalento titulo="Cadastro existente" subtitulo="Já está na base" cor="slate" pessoa={ePessoa} experiencias={eExp} formacao={eForm} competencias={eComp} />
      <ColuncaTalento titulo="Novo CV importado" subtitulo="Dados extraídos pela IA" cor="amber" pessoa={sPessoa} experiencias={sExp} formacao={sForm} competencias={sComp} />
    </div>
  );
}

type ComparePessoa = { nome: string; email: string; fone: string; cidade: string; uf: string; cpf: string; linkedin: string; resumo: string };

function ColuncaTalento({ titulo, subtitulo, cor, pessoa, experiencias, formacao, competencias }: {
  titulo: string;
  subtitulo: string;
  cor: "slate" | "amber";
  pessoa: ComparePessoa;
  experiencias: Record<string, unknown>[];
  formacao: Record<string, unknown>[];
  competencias: Record<string, unknown>[];
}) {
  const headerTone = cor === "amber"
    ? "bg-amber-50 border-amber-200 text-amber-900"
    : "bg-slate-50 border-slate-200 text-slate-800";
  const local = [pessoa.cidade, pessoa.uf].filter(Boolean).join(" / ");

  return (
    <div className={`rounded-xl border ${cor === "amber" ? "border-amber-200" : "border-slate-200"} bg-white overflow-hidden`}>
      <div className={`px-4 py-2 border-b ${headerTone}`}>
        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{subtitulo}</div>
        <div className="text-sm font-semibold">{titulo}</div>
      </div>
      <div className="p-3 space-y-3">
        {/* Identificação */}
        <div className="space-y-1.5">
          <div className="text-base font-semibold leading-tight">{pessoa.nome}</div>
          <div className="grid grid-cols-1 gap-1 text-[12px] text-slate-600">
            {pessoa.email && <div className="flex items-center gap-1.5"><Mail className="size-3.5 shrink-0" />{pessoa.email}</div>}
            {pessoa.fone && <div className="flex items-center gap-1.5"><Phone className="size-3.5 shrink-0" />{pessoa.fone}</div>}
            {local && <div className="flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" />{local}</div>}
            {pessoa.cpf && <div className="text-[11px] text-muted-foreground">CPF: {pessoa.cpf}</div>}
            {pessoa.linkedin && <a href={pessoa.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline truncate"><Linkedin className="size-3.5 shrink-0" />{pessoa.linkedin.replace(/^https?:\/\//, "").replace(/^www\./, "")}</a>}
          </div>
        </div>

        {/* Resumo */}
        {pessoa.resumo && (
          <div className="border-t pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resumo</div>
            <p className="text-[12px] leading-relaxed text-slate-600 whitespace-pre-wrap line-clamp-6">{pessoa.resumo}</p>
          </div>
        )}

        {/* Experiências */}
        {experiencias.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Briefcase className="size-3" /> Experiências ({experiencias.length})
            </div>
            <ul className="space-y-1.5">
              {experiencias.slice(0, 5).map((exp, idx) => {
                const cargo = str(exp.cargo, "");
                const empresa = str(exp.empresa, "");
                const inicio = str(exp.inicio, "");
                const fim = str(exp.fim, "");
                const per = periodo(inicio, fim);
                return (
                  <li key={idx} className="text-[12px] leading-tight">
                    <div className="font-medium">{cargo}{empresa && <span className="text-slate-500 font-normal"> · {empresa}</span>}</div>
                    {per && <div className="text-[11px] text-muted-foreground tabular-nums">{per}</div>}
                  </li>
                );
              })}
              {experiencias.length > 5 && <li className="text-[11px] text-muted-foreground italic">+{experiencias.length - 5} outra(s)</li>}
            </ul>
          </div>
        )}

        {/* Formação */}
        {formacao.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="size-3" /> Formação ({formacao.length})
            </div>
            <ul className="space-y-1">
              {formacao.slice(0, 4).map((f, idx) => {
                const curso = str(f.curso, "");
                const inst = str(f.instituicao, "");
                return (
                  <li key={idx} className="text-[12px] leading-tight">
                    <div className="font-medium">{curso}</div>
                    {inst && <div className="text-[11px] text-slate-500">{inst}</div>}
                  </li>
                );
              })}
              {formacao.length > 4 && <li className="text-[11px] text-muted-foreground italic">+{formacao.length - 4} outra(s)</li>}
            </ul>
          </div>
        )}

        {/* Competências */}
        {competencias.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="size-3" /> Competências ({competencias.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {competencias.slice(0, 12).map((c, idx) => (
                <span key={idx} className="inline-flex items-center rounded border bg-slate-50 text-slate-700 border-slate-200 px-1.5 py-0.5 text-[10px]">
                  {str(c.nome, "")}
                </span>
              ))}
              {competencias.length > 12 && <span className="text-[10px] text-muted-foreground italic">+{competencias.length - 12}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
