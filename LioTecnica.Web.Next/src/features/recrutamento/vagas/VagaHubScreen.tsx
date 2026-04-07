"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Mail,
  MapPin,
  PenSquare,
  RefreshCw,
  ShieldCheck,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import NextStepBanner from "@/components/feedback/NextStepBanner";
import VagaFormModal from "./VagaFormModal";

const BASE = "/app";

type VagaData = Record<string, unknown>;

interface CandidateRow {
  id: string;
  nome: string;
  email: string | null;
  fone: string | null;
  status: string;
  createdAtUtc: string;
}

interface AdmissaoDialogState {
  open: boolean;
  candidate: CandidateRow | null;
  modo: "manual" | "link";
  tipoContratacao: "CLT" | "PJ";
  cpf: string;
  working: boolean;
  linkGerado: string | null;
}

function pick(obj: VagaData | null, key: string, fallback = "—"): string {
  if (!obj) return fallback;
  const v = obj[key];
  if (v == null || v === "") return fallback;
  return String(v);
}

function pickNum(obj: VagaData | null, key: string, fallback = 0): number {
  if (!obj) return fallback;
  const v = obj[key];
  return typeof v === "number" ? v : fallback;
}

function fmtDate(iso: string): string {
  if (!iso || iso === "—") return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

function fmtSalary(min: unknown, max: unknown): string {
  const a = typeof min === "number" ? min : 0;
  const b = typeof max === "number" ? max : 0;
  if (!a && !b) return "A combinar";
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (a && b) return `${fmt(a)} – ${fmt(b)}`;
  return fmt(a || b);
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-emerald-500/15 text-emerald-700" },
  rascunho: { label: "Rascunho", cls: "bg-amber-500/15 text-amber-700" },
  pausada: { label: "Pausada", cls: "bg-amber-500/15 text-amber-700" },
  fechada: { label: "Fechada", cls: "bg-zinc-500/15 text-zinc-700" },
  encerrada: { label: "Encerrada", cls: "bg-zinc-500/15 text-zinc-700" },
};

interface HistoricoEvent {
  acao: string;
  quemFez: string | null;
  dataHora: string;
  entidadeId: string | null;
  entidadeTipo: string | null;
}

function HistoricoTimeline({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<HistoricoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vagaId) return;
    setLoading(true);
    apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}/historico`)
      .then(async (res) => { if (res.ok) setEvents(await res.json() as HistoricoEvent[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vagaId]);

  if (loading) return <div className="text-center py-6 text-sm text-muted-foreground">Carregando histórico...</div>;
  if (events.length === 0) return <div className="text-center py-6 text-sm text-muted-foreground">Nenhum evento registrado.</div>;

  return (
    <div className="relative border-l-2 border-border/40 pl-6 space-y-4">
      {events.map((ev, i) => (
        <div key={i} className="relative">
          <div className={`absolute -left-[31px] top-1 size-4 rounded-full border-2 ${
            ev.acao.includes("criada") ? "bg-primary/20 border-primary" :
            ev.acao.includes("aprovada") ? "bg-emerald-500/20 border-emerald-500" :
            ev.acao.includes("Candidato") ? "bg-violet-500/20 border-violet-500" :
            ev.acao.includes("Admissão") ? "bg-amber-500/20 border-amber-500" :
            "bg-blue-500/20 border-blue-500"
          }`} />
          <div className="text-xs text-muted-foreground">{new Date(ev.dataHora).toLocaleString("pt-BR")}</div>
          <div className="text-sm font-medium">
            {ev.entidadeTipo === "candidato" && ev.entidadeId ? (
              <button type="button" className="text-primary hover:underline" onClick={() => router.push(`/candidatos?vagaId=${encodeURIComponent(vagaId)}`)}>
                {ev.acao}
              </button>
            ) : ev.acao}
          </div>
          {ev.quemFez && <div className="text-xs text-muted-foreground">por {ev.quemFez}</div>}
        </div>
      ))}
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function VagaHubScreen({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const { me } = useAuth();
  const isRecrutador = me?.isAdmin || (me?.roles ?? []).some((r) => r.toLowerCase().includes("recrutador"));

  const [loading, setLoading] = useState(true);
  const [vaga, setVaga] = useState<VagaData | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [activeTab, setActiveTab] = useState("resumo");
  const [editOpen, setEditOpen] = useState(false);
  const [admissaoDialog, setAdmissaoDialog] = useState<AdmissaoDialogState>({
    open: false, candidate: null, modo: "manual", tipoContratacao: "CLT", cpf: "", working: false, linkGerado: null,
  });
  const [newCandidateOpen, setNewCandidateOpen] = useState(false);
  const [newCandForm, setNewCandForm] = useState({ nome: "", email: "", fone: "", cidade: "", uf: "SP", fonte: "Email", pretensaoSalarial: "", trabalhandoAtualmente: "", linkedinUrl: "", obs: "" });
  const [newCandWorking, setNewCandWorking] = useState(false);
  const [newCandDocTipo, setNewCandDocTipo] = useState("curriculo");
  const [newCandDocDesc, setNewCandDocDesc] = useState("");
  const [newCandDocFile, setNewCandDocFile] = useState<File | null>(null);
  const [newCandPendingDocs, setNewCandPendingDocs] = useState<Array<{ id: string; tipo: string; desc: string; file: File; name: string; size: number }>>([]);

  const load = useCallback(async () => {
    if (!vagaId) return;
    try {
      setLoading(true);
      const [data, candListData] = await Promise.all([
        fetchJson<VagaData>(`/api/vagas/${encodeURIComponent(vagaId)}`),
        fetchJson<{ totalCount?: number; items?: CandidateRow[] }>(`/api/candidatos?vagaId=${encodeURIComponent(vagaId)}&pageSize=100`).catch(() => null),
      ]);
      setVaga(data);
      const items = candListData?.items ?? [];
      setCandidates(items);
      setCandidateCount(candListData?.totalCount ?? items.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar vaga.";
      console.error("[VagaHub] load error:", msg, "vagaId:", vagaId);
      toast.error(`Erro ao carregar vaga: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [vagaId]);

  async function iniciarAdmissao() {
    const { candidate, modo, tipoContratacao, cpf } = admissaoDialog;
    if (!candidate) return;
    setAdmissaoDialog((d) => ({ ...d, working: true }));
    try {
      const res = await fetchJson<{ id: string }>("/api/pre-admissao/iniciar-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidatoId: candidate.id, tipoContratacao }),
      });
      if (modo === "manual") {
        setAdmissaoDialog((d) => ({ ...d, open: false, working: false }));
        router.push(`/admissao/nova?id=${encodeURIComponent(res.id)}`);
      } else {
        const linkRes = await fetchJson<{ publicUrl?: string }>(`/api/pre-admissao/${encodeURIComponent(res.id)}/gerar-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: cpf.replace(/\D/g, "") }),
        });
        setAdmissaoDialog((d) => ({ ...d, working: false, linkGerado: linkRes.publicUrl ?? "enviado" }));
        toast.success("Email enviado ao candidato com o link para preencher os dados!");
        void load(); // recarregar candidatos para atualizar botões
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(`Falha ao iniciar admissão: ${msg}`);
      setAdmissaoDialog((d) => ({ ...d, working: false }));
    }
  }

  useEffect(() => { void load(); }, [load]);

  const title = pick(vaga, "titulo", "Carregando...");
  const statusRaw = pick(vaga, "status", "Rascunho");
  const status = statusRaw.toLowerCase();
  const statusMeta = STATUS_MAP[status] ?? STATUS_MAP.rascunho;
  const isRascunho = status === "rascunho";
  const requisitos = Array.isArray(vaga?.requisitos) ? (vaga.requisitos as unknown[]) : [];
  const etapas = Array.isArray(vaga?.etapas) ? (vaga.etapas as { nome: string; responsavel?: string; slaDias?: number }[]) : [];
  const tags = pick(vaga, "tagsKeywordsRaw", "");
  const areaName = pick(vaga, "areaName", "");
  const modalidadeStr = pick(vaga, "modalidade", "");
  const senioridadeStr = pick(vaga, "senioridade", "");
  const cidade = pick(vaga, "cidade", "");
  const uf = pick(vaga, "uf", "");
  const localStr = [cidade, uf].filter(v => v && v !== "—").join(", ") || "—";
  const tipoContratacao = pick(vaga, "tipoContratacao", "");
  const qtdVagas = pick(vaga, "quantidadeVagas", "1");
  const matchMin = pickNum(vaga, "matchMinimoPercentual", 60);
  const resumo = pick(vaga, "resumoPitch", "");
  const descPublica = pick(vaga, "descricaoPublica", "");
  const recrutador = pick(vaga, "recrutadorResponsavel", "");
  const gestor = pick(vaga, "gestorRequisitante", "");

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/vagas")}><ArrowLeft className="size-4" /></Button>
          <div className="h-7 w-64 animate-pulse rounded-lg bg-muted" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
      </section>
    );
  }

  return (
    <section className="space-y-4 max-w-6xl mx-auto px-4 sm:px-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/vagas")}><ArrowLeft className="size-4" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>{statusMeta.label}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
              {pick(vaga, "codigo") !== "—" && <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded">{pick(vaga, "codigo")}</span>}
              <span>{areaName || "—"}</span>
              <span className="text-border">|</span>
              <span>{modalidadeStr || "—"}</span>
              {(vaga?.createdAtUtc as string) && (
                <>
                  <span className="text-border">|</span>
                  <span>Criada em {new Date(vaga!.createdAtUtc as string).toLocaleDateString("pt-BR")}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" /></Button>
          {isRecrutador && (
            <Button size="sm" onClick={() => router.push(`/vagas/editar?id=${encodeURIComponent(vagaId)}`)}><PenSquare className="size-4 mr-1" /> {isRascunho ? "Preencher Dados" : "Editar"}</Button>
          )}
        </div>
      </div>

      {/* ── Indicador rascunho ── */}
      {isRascunho && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          Vaga em <b>rascunho</b> — preencha os dados e mude o status para &quot;Aberta&quot; para publicar.
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={(v) => { if (v === "matching") { toast("Matching IA estará disponível em breve"); return; } setActiveTab(v); }}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="candidatos">
            Candidatos {candidateCount > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5">{candidateCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="config">Etapas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="matching" className="opacity-40">
            Matching IA
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Resumo ── */}
        <TabsContent value="resumo" className="space-y-4 mt-4">
          {/* Responsáveis */}
          {(recrutador || gestor) && (
            <div className="flex flex-wrap gap-6 text-sm">
              {recrutador && recrutador !== "—" && (
                <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Recrutador</div><div className="font-medium">{recrutador}</div></div>
              )}
              {gestor && gestor !== "—" && (
                <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Gestor requisitante</div><div className="font-medium">{gestor}</div></div>
              )}
            </div>
          )}

          {/* Data de criação — inline */}

          {/* Info grid */}
          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Modalidade</div><div className="font-medium">{modalidadeStr || "—"}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Senioridade</div><div className="font-medium">{senioridadeStr || "—"}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Local</div><div className="font-medium">{localStr}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Faixa salarial</div><div className="font-medium">{fmtSalary(vaga?.salarioMinimo, vaga?.salarioMaximo)}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Contratação</div><div className="font-medium">{tipoContratacao || "—"}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Vagas</div><div className="font-medium">{qtdVagas}</div></div>
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> Início: {fmtDate(pick(vaga, "dataInicio", ""))}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> Encerramento: {fmtDate(pick(vaga, "dataEncerramento", ""))}</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Match min: <strong className="text-foreground">{matchMin}%</strong></span>
          </div>

          {/* Resumo */}
          {resumo && resumo !== "—" && (
            <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Resumo</div>
              <div className="text-sm leading-relaxed whitespace-pre-line">{resumo}</div>
            </div>
          )}

          {/* Descrição Pública */}
          {descPublica && descPublica !== "—" && (
            <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Descrição pública</div>
              <div className="text-sm leading-relaxed whitespace-pre-line">{descPublica}</div>
            </div>
          )}

          {/* Tags */}
          {tags !== "—" && (
            <div className="flex flex-wrap gap-1.5">
              {tags.split(/[;,]/).filter(Boolean).map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">{tag.trim()}</Badge>
              ))}
            </div>
          )}

          {/* Requisitos */}
          {requisitos.length > 0 && (
            <div className="rounded-lg border border-border/40 p-4">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Requisitos ({requisitos.length})</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {requisitos.map((r, i) => {
                  const req = r as Record<string, unknown>;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className={`size-2 rounded-full shrink-0 ${Boolean(req.obrigatorio) ? "bg-red-500" : "bg-blue-400"}`} />
                      <span className="truncate">{String(req.nome ?? req.keyword ?? "")}</span>
                      {Boolean(req.obrigatorio) && <span className="text-[10px] text-red-600 font-medium shrink-0">obrig.</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Checklist da vaga</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: "Dados básicos", done: title !== "—" && title !== "Carregando..." },
                { label: "Requisitos", done: requisitos.length > 0 },
                { label: "Etapas de seleção", done: etapas.length > 0 },
                { label: "Publicação", done: status === "aberta" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <CheckCircle2 className={`size-3.5 ${item.done ? "text-emerald-600" : "text-muted-foreground/30"}`} />
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Candidatos ── */}
        <TabsContent value="candidatos" className="mt-4 space-y-3 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{candidateCount} candidato(s) nesta vaga</p>
            <div className="flex gap-2">
              {isRecrutador && (
                <Button size="sm" onClick={() => setNewCandidateOpen(true)}>
                  <UserPlus className="size-3.5 mr-1" /> Candidato
                </Button>
              )}
            </div>
          </div>
          {candidates.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-card p-6 text-center">
              <Users className="mx-auto size-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum candidato nesta vaga ainda.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Data</th>
                    {isRecrutador && <th className="px-3 py-2 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {candidates.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{c.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{c.email ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700">{c.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(c.createdAtUtc).toLocaleDateString("pt-BR")}</td>
                      {isRecrutador && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <Button size="sm" variant="outline" onClick={() => {
                              const vagaTipo = pick(vaga, "tipoContratacao").toUpperCase();
                              const tipo = (vagaTipo === "CLT" || vagaTipo === "PJ") ? vagaTipo as "CLT" | "PJ" : "CLT";
                              setAdmissaoDialog({ open: true, candidate: c, modo: "manual", tipoContratacao: tipo, cpf: "", working: false, linkGerado: null });
                            }}>
                              <Mail className="size-3.5 mr-1" /> {c.status === "Aprovado" ? "Reenviar" : "Aprovar Candidato"}
                            </Button>
                            {c.status === "Aprovado" && (
                              <Button size="sm" variant="outline" onClick={async () => {
                                try {
                                  const res = await apiFetch(`/api/pre-admissao/iniciar-manual`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ candidatoId: c.id }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json() as { id: string };
                                    router.push(`/admissao/nova?id=${encodeURIComponent(data.id)}`);
                                  }
                                } catch { toast.error("Erro ao abrir admissão"); }
                              }}>
                                Acompanhar
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Matching IA desabilitado temporariamente */}

        {/* ── Tab: Configuração ── */}
        <TabsContent value="config" className="space-y-4 mt-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          {/* Etapas */}
          <div className="rounded-lg border border-border/40 p-4">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-3">Etapas de seleção ({etapas.length})</div>
            {etapas.length > 0 ? (
              <div className="space-y-2">
                {etapas.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/20 px-3 py-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                    <span className="font-medium">{e.nome}</span>
                    {e.responsavel && <span className="text-xs text-muted-foreground">({e.responsavel})</span>}
                    {e.slaDias != null && <span className="text-xs text-muted-foreground ml-auto">{e.slaDias}d SLA</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Nenhuma etapa configurada.</p>
                {isRecrutador && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push(`/vagas/editar?id=${encodeURIComponent(vagaId)}`)}>
                    Configurar Etapas
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/pipeline?vagaId=${encodeURIComponent(vagaId)}`}>Ir para Pipeline</Link>
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab: Histórico ── */}
        <TabsContent value="historico" className="mt-4 space-y-3 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <HistoricoTimeline vagaId={vagaId} />
        </TabsContent>
      </Tabs>

      {/* ── New Candidate — modal customizado idêntico ao CandidatosScreen ── */}
      {newCandidateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setNewCandidateOpen(false)}>
          <div className="rounded-xl border border-border/50 bg-card shadow-sm w-full max-w-3xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Novo candidato</p>
                <div className="text-lg font-extrabold">Cadastro</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setNewCandidateOpen(false)}>Fechar</Button>
            </div>
            <div className="mt-4 space-y-4">
            {/* Vaga (travada) */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <label className="text-[10px] font-semibold text-blue-700 uppercase tracking-widest mb-1 block">Vaga</label>
              <div className="text-sm font-medium">{title}</div>
            </div>

            {/* Dados do Candidato */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Dados do Candidato</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Nome *</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={newCandForm.nome} onChange={(e) => setNewCandForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="md:col-span-6">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Email *</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="email" value={newCandForm.email} onChange={(e) => setNewCandForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Telefone</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={newCandForm.fone} onChange={(e) => setNewCandForm(f => ({ ...f, fone: e.target.value }))} placeholder="(11) 99999-0000" />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Cidade</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={newCandForm.cidade} onChange={(e) => setNewCandForm(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">UF</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" maxLength={2} value={newCandForm.uf} onChange={(e) => setNewCandForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} placeholder="SP" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Fonte</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newCandForm.fonte} onChange={(e) => setNewCandForm(f => ({ ...f, fonte: e.target.value }))}>
                    {["Email","Site","Indicacao","LinkedIn","Pasta"].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Informações Profissionais */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Informações Profissionais</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Pretensão salarial (R$)</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="number" min={0} step={100} placeholder="Ex: 5000" value={newCandForm.pretensaoSalarial} onChange={(e) => setNewCandForm(f => ({ ...f, pretensaoSalarial: e.target.value }))} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Trabalhando atualmente?</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newCandForm.trabalhandoAtualmente} onChange={(e) => setNewCandForm(f => ({ ...f, trabalhandoAtualmente: e.target.value }))}>
                    <option value="">Não informado</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Status</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" disabled>
                    <option>Triagem</option>
                  </select>
                </div>
                <div className="md:col-span-8">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">LinkedIn</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="url" placeholder="https://linkedin.com/in/..." value={newCandForm.linkedinUrl} onChange={(e) => setNewCandForm(f => ({ ...f, linkedinUrl: e.target.value }))} />
                </div>
                <div className="md:col-span-12">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Observações</label>
                  <textarea className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={2} value={newCandForm.obs} onChange={(e) => setNewCandForm(f => ({ ...f, obs: e.target.value }))} placeholder="Observações sobre o candidato..." />
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div>
              <div className="rounded-xl border border-border/40 bg-muted/5 p-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Documentos</h3>
                <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm mb-3">
                  Os documentos serão enviados ao salvar o candidato.
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Tipo</label>
                    <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newCandDocTipo} onChange={(e) => setNewCandDocTipo(e.target.value)}>
                      <option value="curriculo">Currículo</option>
                      <option value="documento">Documento</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Descrição</label>
                    <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={newCandDocDesc} onChange={(e) => setNewCandDocDesc(e.target.value)} placeholder="Ex.: CV atualizado" />
                  </div>
                  <div className="overflow-hidden">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Arquivo</label>
                    <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700" type="file" onChange={(e) => setNewCandDocFile(e.currentTarget.files?.[0] ?? null)} />
                  </div>
                </div>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!newCandDocFile) return toast.error("Selecione um arquivo.");
                    setNewCandPendingDocs(prev => [...prev, { id: crypto.randomUUID(), tipo: newCandDocTipo, desc: newCandDocDesc, file: newCandDocFile, name: newCandDocFile.name, size: newCandDocFile.size }]);
                    setNewCandDocDesc("");
                    setNewCandDocFile(null);
                    toast.success("Documento adicionado. Será enviado ao salvar.");
                  }}>Adicionar documento</Button>
                </div>
                {newCandPendingDocs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="font-medium text-sm">Pendentes ({newCandPendingDocs.length})</div>
                    {newCandPendingDocs.map(d => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.tipo} • {d.desc || "Sem descrição"} • {(d.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => setNewCandPendingDocs(prev => prev.filter(x => x.id !== d.id))}>Remover</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewCandidateOpen(false)}>Cancelar</Button>
            <Button disabled={!newCandForm.nome.trim() || !newCandForm.email.trim() || newCandWorking} onClick={async () => {
              setNewCandWorking(true);
              try {
                const res = await apiFetch("/api/candidatos", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    nome: newCandForm.nome.trim(),
                    email: newCandForm.email.trim(),
                    fone: newCandForm.fone.trim() || null,
                    cidade: newCandForm.cidade.trim() || null,
                    uf: newCandForm.uf || null,
                    fonte: newCandForm.fonte,
                    status: "Triagem",
                    pretensaoSalarial: newCandForm.pretensaoSalarial ? parseFloat(newCandForm.pretensaoSalarial) : null,
                    trabalhandoAtualmente: newCandForm.trabalhandoAtualmente === "sim" ? true : newCandForm.trabalhandoAtualmente === "nao" ? false : null,
                    linkedinUrl: newCandForm.linkedinUrl.trim() || null,
                    obs: newCandForm.obs.trim() || null,
                    vagaId: vagaId,
                  }),
                });
                if (!res.ok) {
                  const body = await res.json().catch(() => ({})) as Record<string, string>;
                  throw new Error(body.message || body.detail || `Erro ${res.status}`);
                }
                toast.success("Candidato adicionado!");
                setNewCandidateOpen(false);
                setNewCandForm({ nome: "", email: "", fone: "", cidade: "", uf: "SP", fonte: "Email", pretensaoSalarial: "", trabalhandoAtualmente: "", linkedinUrl: "", obs: "" });
                setNewCandPendingDocs([]);
                void load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao criar candidato");
              } finally {
                setNewCandWorking(false);
              }
            }}>
              {newCandWorking ? "Salvando..." : "Salvar"}
            </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editOpen && (
        <VagaFormModal
          open={editOpen}
          editId={vagaId}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); void load(); }}
        />
      )}

      {/* ── Dialog: Aprovar Candidato ── */}
      <Dialog open={admissaoDialog.open} onOpenChange={(o) => !admissaoDialog.working && setAdmissaoDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar Candidato — {admissaoDialog.candidate?.nome}</DialogTitle>
          </DialogHeader>
          {admissaoDialog.linkGerado ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
                <Mail className="mx-auto size-8 text-emerald-600 mb-2" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Email enviado com sucesso!</p>
                <p className="text-xs text-emerald-600/80 mt-1">O candidato receberá um email com o link para preencher seus dados de admissão.</p>
              </div>
              {/* Link disponível para copiar se necessário */}
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdmissaoDialog((d) => ({ ...d, open: false }))}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tipo de contratação */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo de contratação</label>
                <div className="flex gap-2">
                  {(["CLT", "PJ"] as const).map((tipo) => (
                    <button key={tipo} type="button"
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${admissaoDialog.tipoContratacao === tipo ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted/20"}`}
                      onClick={() => setAdmissaoDialog((d) => ({ ...d, tipoContratacao: tipo }))}
                    >{tipo}</button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {admissaoDialog.tipoContratacao === "CLT"
                    ? "Documentos: RG, CPF, Comp. Residência, CTPS, Título Eleitor, PIS, Certidão, Escolaridade, Dados Bancários"
                    : "Documentos: CNPJ, Contrato Social/MEI, RG+CPF Sócio, Conta PJ, Certidões Negativas"}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">Escolha como prosseguir:</p>
              <div className="space-y-2">
                {([
                  { value: "manual", label: "Preencher manualmente", desc: "RH preenche os dados no sistema" },
                  { value: "link", label: "Enviar link para candidato", desc: "Candidato preenche os dados online" },
                ] as const).map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${admissaoDialog.modo === opt.value ? "border-primary bg-primary/5" : "border-border/40 hover:bg-muted/20"}`}>
                    <input type="radio" name="admissaoModo" value={opt.value} checked={admissaoDialog.modo === opt.value} onChange={() => setAdmissaoDialog((d) => ({ ...d, modo: opt.value }))} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              {admissaoDialog.modo === "link" && (
                <div className="space-y-1.5">
                  <label htmlFor="adm-cpf" className="text-sm font-medium">CPF do candidato <span className="text-destructive">*</span></label>
                  <Input id="adm-cpf" placeholder="000.000.000-00" value={admissaoDialog.cpf} onChange={(e) => setAdmissaoDialog((d) => ({ ...d, cpf: e.target.value }))} autoComplete="off" />
                  <p className="text-xs text-muted-foreground">O candidato usará este CPF para acessar o portal e preencher seus dados.</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" disabled={admissaoDialog.working} onClick={() => setAdmissaoDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
                <Button disabled={admissaoDialog.working || (admissaoDialog.modo === "link" && !admissaoDialog.cpf.trim())} onClick={() => void iniciarAdmissao()}>
                  {admissaoDialog.working ? "Processando…" : "Confirmar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
