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
  Globe,
  Mail,
  MapPin,
  PenSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
import StepperProgress from "@/components/feedback/StepperProgress";
import type { StepperStep } from "@/components/feedback/StepperProgress";
import VagaFormModal from "./VagaFormModal";
import MatchingIaTab from "./MatchingIaTab";

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
  emailEnviado: boolean;
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
  cancelada: { label: "Cancelada", cls: "bg-red-500/15 text-red-700" },
  preenchida: { label: "Preenchida", cls: "bg-blue-500/15 text-blue-700" },
};

const MOTIVO_LABEL: Record<string, string> = {
  desligamento: "Desligado",
  promocao: "Promoção",
  transferencia: "Transferência",
  manual: "Manual",
};

type OcupacaoItem = {
  id: string;
  funcionarioNome: string;
  dataEntrada: string;
  dataSaida?: string | null;
  motivoSaida?: string | null;
  desligamentoSolicitacaoId?: string | null;
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
            ev.acao.includes("reprovada") || ev.acao.includes("cancelada") ? "bg-red-500/20 border-red-500" :
            ev.acao.includes("aprovada") ? "bg-emerald-500/20 border-emerald-500" :
            ev.acao.includes("criada") ? "bg-primary/20 border-primary" :
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

  const [loading, setLoading] = useState(true);
  const [vaga, setVaga] = useState<VagaData | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [activeTab, setActiveTab] = useState("resumo");
  const [editOpen, setEditOpen] = useState(false);
  const [admissaoDialog, setAdmissaoDialog] = useState<AdmissaoDialogState>({
    open: false, candidate: null, modo: "manual", tipoContratacao: "CLT", cpf: "", working: false, linkGerado: null, emailEnviado: false,
  });
  const [newCandidateOpen, setNewCandidateOpen] = useState(false);
  const [newCandForm, setNewCandForm] = useState({ nome: "", email: "", fone: "", cidade: "", uf: "SP", fonte: "Email", pretensaoSalarial: "", trabalhandoAtualmente: "", linkedinUrl: "", obs: "" });
  const [newCandWorking, setNewCandWorking] = useState(false);
  const [newCandDocTipo, setNewCandDocTipo] = useState("curriculo");
  const [newCandDocDesc, setNewCandDocDesc] = useState("");
  const [newCandDocFile, setNewCandDocFile] = useState<File | null>(null);
  const [newCandPendingDocs, setNewCandPendingDocs] = useState<Array<{ id: string; tipo: string; desc: string; file: File; name: string; size: number }>>([]);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);

  // Workflow RH data
  const [workflowData, setWorkflowData] = useState<{
    id: string;
    status: number;
    statusLabel: string;
    totalEtapas: number;
    etapasConcluidas: number;
    etapas: Array<{ label: string; status: number; ordem: number }>;
  } | null>(null);

  const load = useCallback(async () => {
    if (!vagaId) return;
    try {
      setLoading(true);
      const [data, candListData, wfData] = await Promise.all([
        fetchJson<VagaData>(`/api/vagas/${encodeURIComponent(vagaId)}`),
        fetchJson<{ totalCount?: number; items?: CandidateRow[] }>(`/api/candidatos?vagaId=${encodeURIComponent(vagaId)}&pageSize=100`).catch(() => null),
        fetchJson<any>(`/api/workflow-rh?vagaId=${encodeURIComponent(vagaId)}&pageSize=1`).catch(() => null),
      ]);
      setVaga(data);
      const items = candListData?.items ?? [];
      setCandidates(items);
      setCandidateCount(candListData?.totalCount ?? items.length);
      // Workflow RH associated with this vaga
      const wfItems = Array.isArray(wfData) ? wfData : wfData?.items ?? [];
      if (wfItems.length > 0) {
        const wf = wfItems[0];
        setWorkflowData({
          id: wf.id,
          status: wf.status ?? 0,
          statusLabel: wf.statusLabel ?? "",
          totalEtapas: wf.totalEtapas ?? 0,
          etapasConcluidas: wf.etapasConcluidas ?? 0,
          etapas: Array.isArray(wf.etapas) ? wf.etapas : [],
        });
      } else {
        setWorkflowData(null);
      }
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
        const linkRes = await fetchJson<{ publicUrl?: string; emailEnviado?: boolean }>(`/api/pre-admissao/${encodeURIComponent(res.id)}/gerar-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: cpf.replace(/\D/g, "") }),
        });
        setAdmissaoDialog((d) => ({ ...d, working: false, linkGerado: linkRes.publicUrl ?? null, emailEnviado: linkRes.emailEnviado ?? false }));
        void load(); // recarregar candidatos para atualizar botões
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(`Falha ao iniciar admissão: ${msg}`);
      setAdmissaoDialog((d) => ({ ...d, working: false }));
    }
  }

  const [publishing, setPublishing] = useState(false);
  async function publicarVaga() {
    setPublishing(true);
    try {
      const res = await apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Aberta" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      toast.success("Vaga publicada com sucesso!");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao publicar vaga.");
    } finally {
      setPublishing(false);
    }
  }

  async function openEditCandidate(candidateId: string) {
    try {
      const data = await fetchJson<Record<string, unknown>>(`/api/candidatos/${encodeURIComponent(candidateId)}`);
      setNewCandForm({
        nome: String(data.nome ?? ""),
        email: String(data.email ?? ""),
        fone: String(data.fone ?? ""),
        cidade: String(data.cidade ?? ""),
        uf: String(data.uf ?? "SP"),
        fonte: String(data.fonte ?? "Email"),
        pretensaoSalarial: data.pretensaoSalarial != null ? String(data.pretensaoSalarial) : "",
        trabalhandoAtualmente: data.trabalhandoAtualmente === true ? "sim" : data.trabalhandoAtualmente === false ? "nao" : "",
        linkedinUrl: String(data.linkedinUrl ?? ""),
        obs: String(data.obs ?? ""),
      });
      setEditingCandidateId(candidateId);
      setNewCandidateOpen(true);
    } catch {
      toast.error("Erro ao carregar candidato");
    }
  }

  function closeCandidateForm() {
    setNewCandidateOpen(false);
    setEditingCandidateId(null);
    setNewCandForm({ nome: "", email: "", fone: "", cidade: "", uf: "SP", fonte: "Email", pretensaoSalarial: "", trabalhandoAtualmente: "", linkedinUrl: "", obs: "" });
    setNewCandPendingDocs([]);
  }

  useEffect(() => { void load(); }, [load]);

  const [ocupacoes, setOcupacoes] = useState<OcupacaoItem[]>([]);
  const [ocupacoesLoading, setOcupacoesLoading] = useState(false);

  useEffect(() => {
    if (!vagaId) return;
    setOcupacoesLoading(true);
    fetchJson<unknown[]>(`/api/vagas/${encodeURIComponent(vagaId)}/ocupacoes`)
      .then((rows) => {
        setOcupacoes((Array.isArray(rows) ? rows : []).map((r) => {
          const rec = r as Record<string, unknown>;
          return {
            id: String(rec.id ?? ""),
            funcionarioNome: String(rec.funcionarioNome ?? rec.nome ?? "—"),
            dataEntrada: String(rec.dataEntrada ?? ""),
            dataSaida: rec.dataSaida ? String(rec.dataSaida) : null,
            motivoSaida: rec.motivoSaida ? String(rec.motivoSaida) : null,
            desligamentoSolicitacaoId: rec.desligamentoSolicitacaoId ? String(rec.desligamentoSolicitacaoId) : null,
          };
        }));
      })
      .catch(() => {})
      .finally(() => setOcupacoesLoading(false));
  }, [vagaId]);

  const title = pick(vaga, "titulo", "Carregando...");
  const statusRaw = pick(vaga, "status", "Rascunho");
  const status = statusRaw.toLowerCase();
  const statusMeta = STATUS_MAP[status] ?? STATUS_MAP.rascunho;
  const isRascunho = status === "rascunho";
  const isCancelada = status === "cancelada";
  const isEncerrada = status === "encerrada";
  const isReadOnly = isCancelada || isEncerrada;
  const requisitos = Array.isArray(vaga?.requisitos) ? (vaga.requisitos as unknown[]) : [];
  const etapas = Array.isArray(vaga?.etapas) ? (vaga.etapas as { nome: string; responsavel?: string; slaDias?: number }[]) : [];
  const tags = pick(vaga, "tagsKeywordsRaw", "");
  const areaName = pick(vaga, "centroCustoName", "") || pick(vaga, "areaName", "");
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
  const headcountAutorizado = pickNum(vaga, "headcountAutorizado", 1);
  const headcountOcupado = pickNum(vaga, "headcountOcupado", 0);
  const isEstrutural = vaga?.isEstrutural === true;

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
    <section className="space-y-4">
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
          {!isReadOnly && (
            <Button size="sm" onClick={() => router.push(`/vagas/editar?id=${encodeURIComponent(vagaId)}`)}><PenSquare className="size-4 mr-1" /> {isRascunho ? "Preencher Dados" : "Editar"}</Button>
          )}
          {isRascunho && (
            <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" disabled={publishing} onClick={() => void publicarVaga()}>
              <Globe className="size-4 mr-1" /> {publishing ? "Publicando..." : "Publicar"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Indicador rascunho ── */}
      {isRascunho && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          Vaga em <b>rascunho</b> — preencha os dados e mude o status para &quot;Aberta&quot; para publicar.
        </div>
      )}

      {/* ── Indicador cancelada/encerrada ── */}
      {isCancelada && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          Esta vaga foi <b>cancelada</b> e não pode mais ser editada.
        </div>
      )}
      {isEncerrada && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/20 dark:text-zinc-400">
          Esta vaga está <b>encerrada</b> e não pode mais ser editada.
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="candidatos">
            Candidatos {candidateCount > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5">{candidateCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="config">Etapas</TabsTrigger>
          {workflowData && <TabsTrigger value="workflow">Workflow</TabsTrigger>}
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="posicao">
            Posição {isEstrutural && headcountOcupado > 0 && <span className="ml-1 text-[10px] bg-blue-500/15 text-blue-700 rounded-full px-1.5">{headcountOcupado}</span>}
          </TabsTrigger>
          <TabsTrigger value="matching" className="gap-1">
            <Sparkles className="size-3.5" /> Matching IA
            {candidateCount > 0 && <span className="ml-0.5 text-[10px] bg-violet-500/15 text-violet-700 rounded-full px-1.5">{candidateCount}</span>}
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
              {!isReadOnly && (
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
                    <th className="px-3 py-2 text-right">Ações</th>
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
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1.5 justify-end">
                          {!isReadOnly && (
                            <Button size="sm" variant="ghost" onClick={() => void openEditCandidate(c.id)}>
                              <PenSquare className="size-3.5" />
                            </Button>
                          )}
                          {!isReadOnly && (
                            <Button size="sm" variant="outline" onClick={() => {
                              const vagaTipo = pick(vaga, "tipoContratacao").toUpperCase();
                              const tipo = (vagaTipo === "CLT" || vagaTipo === "PJ") ? vagaTipo as "CLT" | "PJ" : "CLT";
                              setAdmissaoDialog({ open: true, candidate: c, modo: "manual", tipoContratacao: tipo, cpf: "", working: false, linkGerado: null, emailEnviado: false });
                            }}>
                              <Mail className="size-3.5 mr-1" /> {c.status === "Aprovado" ? "Reenviar" : "Aprovar Candidato"}
                            </Button>
                          )}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Matching IA (Fase 4 — Ollama + pgvector) ── */}
        <TabsContent value="matching" className="mt-4">
          <MatchingIaTab
            vagaId={vagaId}
            candidates={candidates.map((c) => ({ id: c.id, nome: c.nome, email: c.email, status: c.status }))}
            temDescricaoCargo={Boolean(pick(vaga, "descricaoCargoId", "")) || Boolean(pick(vaga, "descricaoCargo", ""))}
          />
        </TabsContent>

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
                <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push(`/vagas/editar?id=${encodeURIComponent(vagaId)}`)}>
                  Configurar Etapas
                </Button>
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

        {/* ── Tab: Workflow RH ── */}
        {workflowData && (
          <TabsContent value="workflow" className="mt-4 space-y-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Status do Workflow</div>
                <div className="text-sm font-medium mt-0.5">
                  {workflowData.status === 0 ? "Não Iniciado" : workflowData.status === 1 ? "Em Andamento" : workflowData.status === 2 ? "Concluído" : "Cancelado"}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {workflowData.etapasConcluidas}/{workflowData.totalEtapas} etapas concluídas
              </div>
            </div>
            {workflowData.etapas.length > 0 ? (
              <StepperProgress
                orientation="vertical"
                steps={workflowData.etapas
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((etapa) => ({
                    label: etapa.label,
                    status:
                      etapa.status === 2
                        ? ("done" as const)
                        : etapa.status === 1
                          ? ("current" as const)
                          : ("pending" as const),
                  }))}
              />
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <p>Workflow criado mas sem etapas detalhadas disponíveis.</p>
                <p className="text-xs mt-1">Progresso: {workflowData.etapasConcluidas}/{workflowData.totalEtapas}</p>
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Tab: Histórico ── */}
        <TabsContent value="historico" className="mt-4 space-y-3 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <HistoricoTimeline vagaId={vagaId} />
        </TabsContent>

        {/* ── Tab: Posição ── */}
        <TabsContent value="posicao" className="mt-4 space-y-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          {/* Headcount summary */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Headcount autorizado</span>
              <span className="font-bold text-lg leading-none">{headcountAutorizado}</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Ocupado</span>
              <span className="font-bold text-lg leading-none">{headcountOcupado}</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Em aberto</span>
              {(() => {
                const aberto = Math.max(0, headcountAutorizado - headcountOcupado);
                return aberto > 0
                  ? <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">{aberto} aberto{aberto > 1 ? "s" : ""}</span>
                  : <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">Completo</span>;
              })()}
            </div>
          </div>

          {/* Occupancy history table */}
          <div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Histórico de Ocupação</div>
            {ocupacoesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-muted" />)}
              </div>
            ) : ocupacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ocupação registrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Funcionário</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entrada</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Saída</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status / Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {ocupacoes.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{o.funcionarioNome}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.dataEntrada ? fmtDate(o.dataEntrada) : "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.dataSaida ? fmtDate(o.dataSaida) : "—"}</td>
                        <td className="px-4 py-2.5">
                          {!o.dataSaida ? (
                            o.desligamentoSolicitacaoId ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">
                                  Em Desligamento
                                </span>
                                <Link
                                  href={`/app/gestao/solicitacoes?tab=desligamentos`}
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline font-medium"
                                  title="Ver solicitação de desligamento"
                                >
                                  <FileText className="size-3" /> Ver
                                </Link>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">Ativo</span>
                            )
                          ) : (o.motivoSaida ?? "").toLowerCase() === "desligamento" ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">Desligado</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 text-zinc-600">
                              {MOTIVO_LABEL[(o.motivoSaida ?? "").toLowerCase()] ?? o.motivoSaida ?? "Histórico"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── New Candidate — modal customizado idêntico ao CandidatosScreen ── */}
      {newCandidateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={closeCandidateForm}>
          <div className="rounded-xl border border-border/50 bg-card shadow-sm w-full max-w-3xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{editingCandidateId ? "Editar candidato" : "Novo candidato"}</p>
                <div className="text-lg font-extrabold">Cadastro</div>
              </div>
              <Button variant="outline" size="sm" onClick={closeCandidateForm}>Fechar</Button>
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
            <Button variant="outline" size="sm" onClick={closeCandidateForm}>Cancelar</Button>
            <Button disabled={!newCandForm.nome.trim() || !newCandForm.email.trim() || newCandWorking} onClick={async () => {
              setNewCandWorking(true);
              try {
                const payload = {
                  nome: newCandForm.nome.trim(),
                  email: newCandForm.email.trim(),
                  fone: newCandForm.fone.trim() || null,
                  cidade: newCandForm.cidade.trim() || null,
                  uf: newCandForm.uf || null,
                  fonte: newCandForm.fonte,
                  pretensaoSalarial: newCandForm.pretensaoSalarial ? parseFloat(newCandForm.pretensaoSalarial) : null,
                  trabalhandoAtualmente: newCandForm.trabalhandoAtualmente === "sim" ? true : newCandForm.trabalhandoAtualmente === "nao" ? false : null,
                  linkedinUrl: newCandForm.linkedinUrl.trim() || null,
                  obs: newCandForm.obs.trim() || null,
                };
                const res = editingCandidateId
                  ? await apiFetch(`/api/candidatos/${encodeURIComponent(editingCandidateId)}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    })
                  : await apiFetch("/api/candidatos", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...payload, status: "Triagem", vagaId }),
                    });
                if (!res.ok) {
                  const body = await res.json().catch(() => ({})) as Record<string, string>;
                  throw new Error(body.message || body.detail || `Erro ${res.status}`);
                }
                toast.success(editingCandidateId ? "Candidato atualizado!" : "Candidato adicionado!");
                closeCandidateForm();
                void load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar candidato");
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
              {admissaoDialog.emailEnviado ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
                  <Mail className="mx-auto size-6 text-emerald-600 mb-1" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Email enviado ao candidato!</p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Email não configurado — compartilhe o link manualmente.</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Link de acesso do candidato:</p>
                <div className="flex gap-2">
                  <input readOnly value={admissaoDialog.linkGerado} className="flex-1 rounded-md border border-input bg-muted/40 px-2 py-1.5 text-xs font-mono truncate" />
                  <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(admissaoDialog.linkGerado!); toast.success("Link copiado!"); }}>Copiar</Button>
                </div>
              </div>
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
                  <label htmlFor="adm-cpf" className="text-sm font-medium">CPF do candidato</label>
                  <Input id="adm-cpf" placeholder="000.000.000-00" value={admissaoDialog.cpf} onChange={(e) => setAdmissaoDialog((d) => ({ ...d, cpf: e.target.value }))} autoComplete="off" />
                  <p className="text-xs text-muted-foreground">Opcional. Se não informado, o candidato registrará o próprio CPF no primeiro acesso ao portal.</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" disabled={admissaoDialog.working} onClick={() => setAdmissaoDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
                <Button disabled={admissaoDialog.working} onClick={() => void iniciarAdmissao()}>
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
